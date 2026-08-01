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
// title matches closely, no rival matches it as well, and the release year
// corroborates. A wrong Spotify album here is a country the player is asked to
// guess from the wrong music.
//
// Everything it will not settle goes to `backfill-review.json` for
// `review-albums.mjs` to walk interactively — including the twenty catalogue
// entries with no year to check against, which can never clear the gate.
//
// Usage:
//   node scripts/backfill-albums.mjs                 # dry run — reports, writes nothing
//   node scripts/backfill-albums.mjs --apply         # merge accepted matches into albums.json
//   node scripts/backfill-albums.mjs --country=Mali  # limit to one country (repeatable)
//   node scripts/backfill-albums.mjs --limit=10      # stop after N albums (for a quick trial)
//
// Then: node scripts/review-albums.mjs
//
// Credentials: see `scripts/lib/spotify.mjs`.
//
// Outputs, all in `scripts/data/`:
//   backfill-report.md    every album, its verdict and the evidence behind it
//   backfill-review.json  what a human still has to decide
//   backfill-matches.json the accepted matches, for the record

import { writeFileSync } from "node:fs";

import {
  MATCHES,
  REPORT,
  REVIEW,
  CANDIDATES_SHOWN,
  MIN_PLAUSIBLE_SIMILARITY,
  appendToLibrary,
  describe,
  isConfident,
  loadGap,
  rank,
} from "./lib/catalogue.mjs";
import {
  PAUSE_MS,
  authenticate,
  searchAlbums,
  sleep,
  trackUrls,
} from "./lib/spotify.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitArg = Number(
  args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length),
);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : Infinity;
const onlyCountries = args
  .filter((a) => a.startsWith("--country="))
  .map((a) => a.slice("--country=".length));

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
    const plausible = ranked
      .filter((c) => c.score >= MIN_PLAUSIBLE_SIMILARITY)
      .slice(0, CANDIDATES_SHOWN);

    if (!best || best.score < MIN_PLAUSIBLE_SIMILARITY) {
      console.log(`${progress} ${album.album_name} — no plausible match`);
      // Still a decision for a human, not a dead end: the review prompt takes a
      // fresh search or a pasted link, which is exactly what this needs.
      notFound.push({
        ...album,
        reason: "no candidate above threshold",
        candidates: [],
      });
      review.push({ ...album, candidates: [] });
      await sleep(PAUSE_MS);
      continue;
    }

    if (!isConfident(ranked)) {
      console.log(
        `${progress} ${album.album_name} — review (${best.score.toFixed(2)})`,
      );
      review.push({ ...album, candidates: plausible });
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
      review.push({ ...album, candidates: plausible });
      await sleep(PAUSE_MS);
      continue;
    }

    if (tracks.length === 0) {
      console.log(
        `${progress} ${album.album_name} — matched but has no tracks`,
      );
      review.push({ ...album, candidates: plausible });
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
  writeFileSync(REVIEW, JSON.stringify(review, null, 2) + "\n");

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

  const total = appendToLibrary(accepted);
  console.log(
    `\nMerged ${accepted.length} album(s) — albums.json now holds ${total}.`,
  );
  if (review.length > 0) {
    console.log(
      `Then: node scripts/review-albums.mjs   (${review.length} left to decide)`,
    );
  }
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

  if (accepted.length > 0) {
    lines.push("## Accepted", "");
    for (const a of accepted) {
      lines.push(`- **${a.country}** — ${a.album_name}`);
      lines.push(`  - matched \`${a._match.name}\` (${describe(a._match)})`);
      lines.push(`  - ${a.tracks.length} track(s)`);
    }
    lines.push("");
  }

  if (review.length > 0) {
    lines.push(
      "## Needs review",
      "",
      "No candidate was both a close enough title match and corroborated by its",
      "release year. Walk these with `node scripts/review-albums.mjs`, which",
      "takes a candidate number, a fresh search, or a Spotify link you paste in.",
      "",
    );
    for (const a of review) {
      lines.push(`- **${a.country}** — ${a.album_name}`);
      for (const c of a.candidates) {
        lines.push(
          `  - \`${c.name}\` — ${describe(c)} — https://open.spotify.com/album/${c.id}`,
        );
      }
      if (a.candidates.length === 0)
        lines.push("  - (search found nothing close)");
    }
    lines.push("");
  }

  if (notFound.length > 0) {
    lines.push(
      "## Not found",
      "",
      "Search returned nothing close enough to show. These are in the review pile too.",
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

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
