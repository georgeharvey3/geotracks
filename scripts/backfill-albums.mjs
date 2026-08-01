#!/usr/bin/env node
// Fills the gap between the Smithsonian Folkways *catalogue* and the app's
// music library (issue #41).
//
// The catalogue (`scripts/data/folkways-catalogue.json`) is the set of albums
// the app intends to hold, transcribed from the Google Sheets the library was
// originally built from. `src/albums.json` is what it actually holds. The two
// drifted apart: the sheets carry a liner-note PDF per album but no Spotify
// IDs, so every album had to be looked up by hand, and the transcription
// stopped partway. This script does that lookup.
//
// It is a *reconciliation*, not an import: albums already in albums.json are
// left exactly as they are, so re-running it is safe and only ever adds.
//
// Matching is deliberately conservative. Spotify's search is fuzzy and the
// archive is full of near-identical titles ("Music of Indonesia, Vol. 1"
// through "Vol. 20"), so a candidate is only accepted automatically when the
// title matches closely, no rival matches it as well, AND the release year
// corroborates (see ARCHIVE_LABELS for why the label cannot). Everything else
// is written out for a human to look at rather than guessed at — a wrong
// Spotify album here is a country the player is asked to guess from the wrong
// music. 125 of the 145 missing albums carry a year and can clear the gate;
// the other 20 will always land in the report.
//
// Usage:
//   node scripts/backfill-albums.mjs                 # dry run — reports, writes nothing
//   node scripts/backfill-albums.mjs --apply         # merge accepted matches into albums.json
//   node scripts/backfill-albums.mjs --country=Mali  # limit to one country (repeatable)
//   node scripts/backfill-albums.mjs --limit=10      # stop after N albums (for a quick trial)
//
// Credentials: a Spotify app's client ID and secret, via $SPOTIFY_CLIENT_ID and
// $SPOTIFY_CLIENT_SECRET. Create one at https://developer.spotify.com/dashboard
// — no review or redirect URI is needed for the client-credentials flow this
// uses. These are REAL SECRETS, unlike the VITE_FIREBASE_* values: keep them
// out of `.env` and out of any VITE_-prefixed variable, or Vite will inline
// them into the browser bundle. Export them in the shell instead.
//
// Both outputs land in `scripts/data/`:
//   backfill-report.md    every album, its verdict and the evidence behind it
//   backfill-matches.json the accepted matches, so --apply can re-use a run
//                         without hitting the API again

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(repoRoot, "scripts", "data");

const CATALOGUE = join(dataDir, "folkways-catalogue.json");
const LIBRARY = join(repoRoot, "src", "albums.json");
const REPORT = join(dataDir, "backfill-report.md");
const MATCHES = join(dataDir, "backfill-matches.json");

// Every imprint the Smithsonian absorbed into Folkways. A candidate album whose
// Spotify label is one of these is almost certainly the right record; one whose
// label is none of them is almost certainly a same-titled reissue by someone
// else.
//
// In practice this currently decides nothing, and the code is kept only so it
// starts working again if the field comes back. `label` lives on the full album
// object, not on a search result — but fetching the full object turns out to be
// no help twice over: `GET /albums?ids=` answers a client-credentials token
// with a flat 403, and `GET /albums/{id}`, which does work, omits `label`
// anyway now that Spotify marks it deprecated. So the release year is the only
// corroboration actually available, which is why `isConfident` accepts it
// alone. See the probe results in issue #41.
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
// "Taqasim") but not a different volume number. See `isConfident` for the rest
// of the gate.
const AUTO_ACCEPT_SIMILARITY = 0.9;

// Below this a candidate is not worth showing at all — the search missed.
const MIN_PLAUSIBLE_SIMILARITY = 0.55;

// A runner-up within this of the leader means the title cannot separate them.
const RIVAL_MARGIN = 0.02;

const SEARCH_LIMIT = 10;
const PAGE_SIZE = 50;

// How many candidates the report prints per album for a human to choose from.
const CANDIDATES_SHOWN = 5;

// Spotify's rate limit is a rolling 30-second window whose size it does not
// publish, and a new app is in development mode, where it is lower. A short
// pause between albums keeps a 145-album run under it; 429s are still handled
// below, because the limit also counts whatever else the account did. Raise
// this if a run reports repeated waits.
const PAUSE_MS = 120;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitArg = Number(
  args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length),
);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : Infinity;
const onlyCountries = args
  .filter((a) => a.startsWith("--country="))
  .map((a) => a.slice("--country=".length));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The form titles are compared in: case, punctuation, diacritics and the
 * trailing year all removed, so "Egypt: Taqâsîm & Layâlî (1971)" and
 * "Egypt: Taqasim and Layali" collapse to the same string.
 */
function normalise(title) {
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
function yearOf(title) {
  const match = title.match(/\((?:.*?)\b((?:19|20)\d\d)\s*\)\s*$/);
  return match ? Number(match[1]) : null;
}

/**
 * Similarity in [0, 1] by Dice coefficient over character bigrams. Chosen over
 * edit distance because it is insensitive to word order and to a long common
 * prefix — "Music of Indonesia, Vol. 13" and "Vol. 14" share that prefix and
 * must still come out clearly apart.
 */
function similarity(a, b) {
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

function isArchiveLabel(label = "") {
  const lower = label.toLowerCase();
  return ARCHIVE_LABELS.some((name) => lower.includes(name));
}

// --- Spotify -----------------------------------------------------------------

let accessToken = null;

async function authenticate() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.\n" +
        "Create an app at https://developer.spotify.com/dashboard, then:\n" +
        "  export SPOTIFY_CLIENT_ID=...\n" +
        "  export SPOTIFY_CLIENT_SECRET=...\n" +
        "Do NOT put these in .env — anything Vite can see can reach the bundle.",
    );
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(
      `Spotify auth failed: ${res.status} ${res.statusText}. Check the client ID and secret.`,
    );
  }
  accessToken = (await res.json()).access_token;
}

/**
 * A Spotify GET that survives the two things that interrupt a long run: the
 * hour-long token expiring (401 — re-authenticate once and retry) and the rate
 * limiter (429 — wait exactly as long as it asks).
 */
async function api(path, attempt = 0) {
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 && attempt === 0) {
    await authenticate();
    return api(path, attempt + 1);
  }
  if (res.status === 429 && attempt < 5) {
    const wait = (Number(res.headers.get("retry-after")) || 2) + 1;
    console.log(`  rate limited, waiting ${wait}s`);
    await sleep(wait * 1000);
    return api(path, attempt + 1);
  }
  if (!res.ok) {
    // Spotify explains itself in the body, not the status line — a bare
    // "403 Forbidden" sends you reading changelogs for an answer that was in
    // the response all along.
    const detail = await res.text().then(
      (body) => {
        try {
          return JSON.parse(body).error?.message ?? body.slice(0, 200);
        } catch {
          return body.slice(0, 200);
        }
      },
      () => "",
    );
    throw new Error(
      `GET ${path} failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return res.json();
}

async function searchAlbums(title) {
  const query = encodeURIComponent(normalise(title));
  const body = await api(`search?q=${query}&type=album&limit=${SEARCH_LIMIT}`);
  return body.albums?.items ?? [];
}

/** Every track URL on an album, following Spotify's pagination to the end. */
async function trackUrls(albumId) {
  const urls = [];
  let offset = 0;
  for (;;) {
    const page = await api(
      `albums/${albumId}/tracks?limit=${PAGE_SIZE}&offset=${offset}`,
    );
    for (const track of page.items ?? []) {
      if (track?.external_urls?.spotify) urls.push(track.external_urls.spotify);
    }
    if (!page.next) return urls;
    offset += PAGE_SIZE;
  }
}

/**
 * The best candidate for one catalogue album, with the evidence that ranked it.
 * Label agreement and a matching year are corroboration, never a substitute for
 * the title: a candidate is scored on title alone and the other two only decide
 * whether that score is trusted without review.
 */
function rank(title, candidates) {
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
 * case. Beyond that it needs *one* piece of corroboration, from either the
 * label or the release year. Requiring the label specifically was the original
 * rule and it accepted nothing at all, because search results carry no label;
 * that is now fixed, but Spotify also marks `label` deprecated, so a rule that
 * depends on it alone is a rule with an expiry date. A matching year is
 * independent evidence and survives the field's removal.
 */
function isConfident(ranked) {
  const [best, runnerUp] = ranked;
  if (!best || best.score < AUTO_ACCEPT_SIMILARITY) return false;
  if (runnerUp && runnerUp.score >= best.score - RIVAL_MARGIN) return false;
  return best.labelMatches || best.yearMatches;
}

// --- Reconciliation ----------------------------------------------------------

function loadGap() {
  const catalogue = JSON.parse(readFileSync(CATALOGUE, "utf8"));
  const library = JSON.parse(readFileSync(LIBRARY, "utf8"));

  const held = new Set(library.map((a) => normalise(a.album_name)));
  const gap = catalogue.albums.filter(
    (a) => !held.has(normalise(a.album_name)),
  );

  // The catalogue is meant to be a superset of the library. Anything the
  // library holds that the catalogue does not is a transcription error in one
  // of the two, and worth saying out loud rather than silently ignoring.
  const catalogued = new Set(
    catalogue.albums.map((a) => normalise(a.album_name)),
  );
  const orphans = library.filter(
    (a) => !catalogued.has(normalise(a.album_name)),
  );

  return { catalogue, library, gap, orphans };
}

async function main() {
  const { catalogue, library, gap, orphans } = loadGap();

  console.log(
    `Catalogue ${catalogue.albums.length} · library ${library.length} · gap ${gap.length}`,
  );
  if (orphans.length > 0) {
    console.log(
      `Note: ${orphans.length} album(s) in albums.json are not in the catalogue:`,
    );
    for (const album of orphans)
      console.log(`  ${album.country} — ${album.album_name}`);
  }

  let todo = gap;
  if (onlyCountries.length > 0) {
    todo = todo.filter((a) => onlyCountries.includes(a.country));
  }
  todo = todo.slice(0, limit);
  if (todo.length === 0) {
    console.log("Nothing to look up.");
    return;
  }
  console.log(`Looking up ${todo.length} album(s).\n`);

  await authenticate();

  const accepted = [];
  const review = [];
  const notFound = [];

  for (const [index, album] of todo.entries()) {
    const progress = `[${index + 1}/${todo.length}]`;
    let ranked;
    try {
      ranked = rank(album.album_name, await searchAlbums(album.album_name));
    } catch (error) {
      console.log(
        `${progress} ${album.album_name} — search failed: ${error.message}`,
      );
      notFound.push({ ...album, reason: error.message, candidates: [] });
      continue;
    }

    const best = ranked[0];
    const plausible = ranked.filter((c) => c.score >= MIN_PLAUSIBLE_SIMILARITY);

    if (!best || best.score < MIN_PLAUSIBLE_SIMILARITY) {
      console.log(`${progress} ${album.album_name} — no plausible match`);
      notFound.push({
        ...album,
        reason: "no candidate above threshold",
        candidates: plausible,
      });
      await sleep(PAUSE_MS);
      continue;
    }

    if (!isConfident(ranked)) {
      console.log(
        `${progress} ${album.album_name} — review (${best.score.toFixed(2)}, ${best.label || "no label"})`,
      );
      review.push({
        ...album,
        candidates: plausible.slice(0, CANDIDATES_SHOWN),
      });
      await sleep(PAUSE_MS);
      continue;
    }

    let tracks;
    try {
      tracks = await trackUrls(best.id);
    } catch (error) {
      console.log(
        `${progress} ${album.album_name} — tracks failed: ${error.message}`,
      );
      review.push({
        ...album,
        candidates: plausible.slice(0, CANDIDATES_SHOWN),
      });
      await sleep(PAUSE_MS);
      continue;
    }

    if (tracks.length === 0) {
      console.log(
        `${progress} ${album.album_name} — matched but has no tracks`,
      );
      review.push({
        ...album,
        candidates: plausible.slice(0, CANDIDATES_SHOWN),
      });
      await sleep(PAUSE_MS);
      continue;
    }

    console.log(
      `${progress} ${album.album_name} — accepted (${tracks.length} tracks)`,
    );
    accepted.push({
      country: album.country,
      album_name: album.album_name,
      tracks,
      _match: best,
    });
    await sleep(PAUSE_MS);
  }

  writeReport({ accepted, review, notFound, gap, orphans });
  writeFileSync(MATCHES, JSON.stringify(accepted, null, 2) + "\n");

  console.log(
    `\nAccepted ${accepted.length} · review ${review.length} · not found ${notFound.length}`,
  );
  console.log(`Report: ${REPORT}`);

  if (!apply) {
    console.log(
      "\nDry run — albums.json untouched. Re-run with --apply to merge.",
    );
    return;
  }

  const merged = [
    ...library,
    ...accepted.map(({ country, album_name, tracks }) => ({
      country,
      album_name,
      tracks,
    })),
  ];
  writeFileSync(LIBRARY, serialiseLibrary(merged));
  console.log(
    `\nMerged ${accepted.length} album(s) — albums.json now holds ${merged.length}.`,
  );
}

/**
 * `albums.json` in exactly the shape it is committed in: four-space indent and
 * every non-ASCII character as a `\uXXXX` escape. `JSON.stringify` emits those
 * characters literally, so serialising the file wholesale rewrites ~30 album
 * titles that were never touched — a diff that buries the albums actually added.
 */
function serialiseLibrary(albums) {
  const escaped = JSON.stringify(albums, null, 4).replace(
    // Astral characters are a surrogate pair each; escaping code *units* keeps
    // them intact, which is what JSON.stringify's own escaping does too.
    /[\u0080-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return escaped + "\n";
}

function writeReport({ accepted, review, notFound, gap, orphans }) {
  const lines = [
    "# Folkways backfill report",
    "",
    `Generated ${new Date().toISOString()} by \`scripts/backfill-albums.mjs\`.`,
    "",
    `Gap: ${gap.length} album(s) in the catalogue but not in \`src/albums.json\`.`,
    `Accepted ${accepted.length}, needs review ${review.length}, not found ${notFound.length}.`,
    "",
  ];

  const evidence = (c) =>
    `${c.score.toFixed(2)} · ${c.label || "no label"}${c.labelMatches ? " ✓" : ""}` +
    ` · ${c.releaseYear ?? "?"}${c.yearMatches ? " ✓" : ""} · ${c.totalTracks} tracks`;

  if (accepted.length > 0) {
    lines.push("## Accepted", "");
    for (const a of accepted) {
      lines.push(`- **${a.country}** — ${a.album_name}`);
      lines.push(`  - matched \`${a._match.name}\` (${evidence(a._match)})`);
      lines.push(`  - ${a.tracks.length} track(s)`);
    }
    lines.push("");
  }

  if (review.length > 0) {
    lines.push(
      "## Needs review",
      "",
      "The title was too close to call, or the label was not one of the archive's.",
      "Pick a candidate and add it by hand, or widen the search terms.",
      "",
    );
    for (const a of review) {
      lines.push(`- **${a.country}** — ${a.album_name}`);
      for (const c of a.candidates) {
        lines.push(
          `  - \`${c.name}\` — ${evidence(c)} — https://open.spotify.com/album/${c.id}`,
        );
      }
    }
    lines.push("");
  }

  if (notFound.length > 0) {
    lines.push(
      "## Not found",
      "",
      "Search returned nothing close enough to show.",
      "",
    );
    for (const a of notFound)
      lines.push(`- **${a.country}** — ${a.album_name} (${a.reason})`);
    lines.push("");
  }

  if (orphans.length > 0) {
    lines.push(
      "## In albums.json but not in the catalogue",
      "",
      "One of the two transcriptions is wrong. Worth checking by hand.",
      "",
    );
    for (const a of orphans) lines.push(`- **${a.country}** — ${a.album_name}`);
    lines.push("");
  }

  writeFileSync(REPORT, lines.join("\n"));
}

// Exported for `scripts/backfill-albums.test.mjs`, which pins the pieces that
// are wrong silently rather than loudly: the serialiser (a bad round-trip
// reformats the whole library), the matcher (a bad score picks Vol. 14 for
// Vol. 13) and the confidence gate (too strict and it accepts nothing, which
// is precisely how it shipped the first time). The rest is I/O and is
// exercised by running the thing.
export {
  normalise,
  yearOf,
  similarity,
  isArchiveLabel,
  rank,
  isConfident,
  serialiseLibrary,
};

// Importing this module must not start a run — the test suite does exactly that.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(CATALOGUE)) {
    console.error(`Missing catalogue: ${CATALOGUE}`);
    process.exit(1);
  }

  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
