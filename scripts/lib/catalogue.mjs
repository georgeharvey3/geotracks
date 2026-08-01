// The app's music library, the Folkways catalogue behind it, and the matching
// that decides whether a Spotify album is the record a catalogue entry names.
//
// Shared by the two halves of the backfill: `backfill-albums.mjs` runs the
// whole gap in one batch, `review-albums.mjs` walks what that could not settle.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const dataDir = join(repoRoot, "scripts", "data");

export const CATALOGUE = join(dataDir, "folkways-catalogue.json");
export const LIBRARY = join(repoRoot, "src", "albums.json");
export const REPORT = join(dataDir, "backfill-report.md");
export const MATCHES = join(dataDir, "backfill-matches.json");
export const REVIEW = join(dataDir, "backfill-review.json");

// Every imprint the Smithsonian absorbed into Folkways. A candidate album whose
// Spotify label is one of these is almost certainly the right record; one whose
// label is none of them is almost certainly a same-titled reissue by someone
// else.
//
// In practice this currently decides nothing, and it is kept only so it starts
// working again if the field comes back: Spotify marks `label` deprecated and
// no longer returns it at all (see `spotify.mjs`). The release year is the only
// corroboration actually available, which is why `isConfident` accepts it alone.
const ARCHIVE_LABELS = [
  "folkways",
  "smithsonian",
  "unesco",
  "monitor",
  "arhoolie",
  "paredon",
  "cook",
  "bri",
  "collector",
];

// Accept without review only at this title similarity or better. 0.9 tolerates
// punctuation and diacritic drift between the sheet and Spotify ("Taqâsîm" vs
// "Taqasim") but not a different volume number.
export const AUTO_ACCEPT_SIMILARITY = 0.9;

// Below this a candidate is not worth showing at all — the search missed.
export const MIN_PLAUSIBLE_SIMILARITY = 0.55;

// A runner-up within this of the leader means the title cannot separate them.
export const RIVAL_MARGIN = 0.02;

// How many candidates to carry through to a human, in the report and the prompt.
export const CANDIDATES_SHOWN = 5;

/**
 * The form titles are compared in: case, punctuation, diacritics and the
 * trailing year all removed, so "Egypt: Taqâsîm & Layâlî (1971)" and
 * "Egypt: Taqasim and Layali" collapse to the same string.
 */
export function normalise(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(\s*(19|20)\d\d\s*\)\s*$/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The year a sheet title carries in its trailing parenthesis, if any. */
export function yearOf(title) {
  const match = title.match(/\((?:.*?)\b((?:19|20)\d\d)\s*\)\s*$/);
  return match ? Number(match[1]) : null;
}

/**
 * Similarity in [0, 1] by Dice coefficient over character bigrams. Chosen over
 * edit distance because it is insensitive to word order and to a long common
 * prefix — "Music of Indonesia, Vol. 13" and "Vol. 14" share that prefix and
 * must still come out clearly apart.
 */
export function similarity(a, b) {
  if (a === b) return 1;
  const bigrams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const pair = s.slice(i, i + 2);
      out.set(pair, (out.get(pair) ?? 0) + 1);
    }
    return out;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const [pair, count] of left) {
    shared += Math.min(count, right.get(pair) ?? 0);
  }
  const total =
    [...left.values()].reduce((n, c) => n + c, 0) +
    [...right.values()].reduce((n, c) => n + c, 0);
  return (2 * shared) / total;
}

export function isArchiveLabel(label = "") {
  const lower = label.toLowerCase();
  return ARCHIVE_LABELS.some((name) => lower.includes(name));
}

/**
 * The candidates for one catalogue album, best first, each with the evidence
 * that ranked it. Label agreement and a matching year are corroboration, never
 * a substitute for the title: a candidate is scored on title alone and the
 * other two only decide whether that score is trusted without review.
 */
export function rank(title, candidates) {
  const wanted = normalise(title);
  const year = yearOf(title);

  return candidates
    .map((album) => {
      const score = similarity(wanted, normalise(album.name));
      const released = Number(album.release_date?.slice(0, 4));
      return {
        id: album.id,
        name: album.name,
        label: album.label ?? "",
        releaseYear: Number.isFinite(released) ? released : null,
        totalTracks: album.total_tracks ?? 0,
        score,
        labelMatches: isArchiveLabel(album.label ?? ""),
        yearMatches: year != null && released === year,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.labelMatches !== b.labelMatches) return a.labelMatches ? -1 : 1;
      return Number(b.yearMatches) - Number(a.yearMatches);
    });
}

/**
 * Whether the leading candidate can be taken without a human looking at it.
 *
 * The title must be close and unrivalled — a runner-up scoring as well means
 * the title alone cannot separate them, which is exactly the Vol. 13 / Vol. 14
 * case. Beyond that it needs one piece of corroboration. Requiring the *label*
 * specifically was the original rule and it accepted nothing at all, twice
 * over: search results carry no label, and neither does the full album object
 * any more. A matching year is independent evidence and survives that.
 */
export function isConfident(ranked) {
  const [best, runnerUp] = ranked;
  if (!best || best.score < AUTO_ACCEPT_SIMILARITY) return false;
  if (runnerUp && runnerUp.score >= best.score - RIVAL_MARGIN) return false;
  return best.labelMatches || best.yearMatches;
}

/** One candidate's evidence, in the one-line form the report and prompt share. */
export function describe(candidate) {
  const label = candidate.label || "no label";
  const year = candidate.releaseYear ?? "?";
  return (
    `${candidate.score.toFixed(2)} · ${label}${candidate.labelMatches ? " ✓" : ""}` +
    ` · ${year}${candidate.yearMatches ? " ✓" : ""} · ${candidate.totalTracks} tracks`
  );
}

// --- The library on disk -----------------------------------------------------

export const readCatalogue = () => JSON.parse(readFileSync(CATALOGUE, "utf8"));
export const readLibrary = () => JSON.parse(readFileSync(LIBRARY, "utf8"));

/**
 * `albums.json` in exactly the shape it is committed in: four-space indent and
 * every non-ASCII character as a `\uXXXX` escape. `JSON.stringify` emits those
 * characters literally, so serialising the file wholesale rewrites ~30 album
 * titles that were never touched — a diff that buries the albums actually
 * added. (`src/albums.json` is in .prettierignore for the same reason.)
 */
export function serialiseLibrary(albums) {
  const escaped = JSON.stringify(albums, null, 4).replace(
    // Astral characters are a surrogate pair each; escaping code *units* keeps
    // them intact, which is what JSON.stringify's own escaping does too.
    /[\u0080-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return escaped + "\n";
}

/** Append albums to the library on disk, preserving its formatting. */
export function appendToLibrary(additions) {
  const merged = [
    ...readLibrary(),
    ...additions.map(({ country, album_name, tracks }) => ({
      country,
      album_name,
      tracks,
    })),
  ];
  writeFileSync(LIBRARY, serialiseLibrary(merged));
  return merged.length;
}

/**
 * What the catalogue holds that the library does not, and vice versa. The
 * catalogue is meant to be a superset; anything the library holds that the
 * catalogue does not is a transcription error in one of the two, and worth
 * saying out loud rather than silently ignoring.
 */
export function loadGap() {
  const catalogue = readCatalogue();
  const library = readLibrary();

  const held = new Set(library.map((a) => normalise(a.album_name)));
  const gap = catalogue.albums.filter(
    (a) => !held.has(normalise(a.album_name)),
  );

  const catalogued = new Set(
    catalogue.albums.map((a) => normalise(a.album_name)),
  );
  const orphans = library.filter(
    (a) => !catalogued.has(normalise(a.album_name)),
  );

  return { catalogue, library, gap, orphans };
}
