#!/usr/bin/env node
// The human half of the Folkways backfill (issue #41).
//
// `backfill-albums.mjs` settles what it can prove and refuses to guess at the
// rest — near-identical titles, and the twenty catalogue entries carrying no
// year to corroborate against ("China", "Croatia", "Fadista!"). It writes those
// to `scripts/data/backfill-review.json`. This walks them one at a time.
//
// For each album it shows the candidates the search found and takes one of:
//
//   1-5    accept that candidate
//   <url>  use this album instead — paste an open.spotify.com link, a
//          spotify:album: URI or a bare id. This is the one that matters:
//          when the search simply missed, the fix is to find the record
//          yourself and hand it over
//   r      search again with different words
//   s      skip, and leave it for next time
//   q      stop here
//
// Every acceptance is written to albums.json immediately, so stopping halfway
// through — or closing the terminal — loses nothing. Re-running picks up where
// it left off, because an album already in the library is no longer in the gap.
//
// Usage:
//   node scripts/review-albums.mjs                # walk the review pile
//   node scripts/review-albums.mjs --country=Mali # just one country
//
// Credentials: as `backfill-albums.mjs` — see `scripts/lib/spotify.mjs`.

import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  REVIEW,
  CANDIDATES_SHOWN,
  MIN_PLAUSIBLE_SIMILARITY,
  describe,
  loadGap,
  normalise,
  rank,
  appendToLibrary,
} from "./lib/catalogue.mjs";
import {
  albumIdFrom,
  authenticate,
  getAlbum,
  searchAlbums,
  trackUrls,
} from "./lib/spotify.mjs";

const onlyCountries = process.argv
  .slice(2)
  .filter((a) => a.startsWith("--country="))
  .map((a) => a.slice("--country=".length));

const rl = createInterface({ input: stdin, output: stdout });

function showCandidates(candidates) {
  if (candidates.length === 0) {
    console.log(
      "  (nothing found — try `r` with different words, or paste a link)",
    );
    return;
  }
  for (const [index, candidate] of candidates.entries()) {
    console.log(`  ${index + 1}. ${candidate.name}`);
    console.log(
      `     ${describe(candidate)} — https://open.spotify.com/album/${candidate.id}`,
    );
  }
}

/** Fetch an album's tracks and add it to the library, or explain why not. */
async function accept(entry, albumId, albumName) {
  const tracks = await trackUrls(albumId);
  if (tracks.length === 0) {
    console.log("  that album has no playable tracks — not adding it\n");
    return false;
  }
  appendToLibrary([
    { country: entry.country, album_name: entry.album_name, tracks },
  ]);
  console.log(`  added ${tracks.length} track(s) from "${albumName}"\n`);
  return true;
}

async function reviewOne(entry, position) {
  let candidates = (entry.candidates ?? []).slice(0, CANDIDATES_SHOWN);

  for (;;) {
    console.log(`\n${position}  ${entry.country} — ${entry.album_name}`);
    showCandidates(candidates);

    const answer = (
      await rl.question("  [1-5 accept · url · r re-search · s skip · q quit] ")
    ).trim();

    if (answer === "q") return "quit";
    if (answer === "s" || answer === "") return "skipped";

    if (answer === "r") {
      const terms = (await rl.question("  search for: ")).trim();
      if (!terms) continue;
      try {
        const found = rank(entry.album_name, await searchAlbums(terms));
        const plausible = found.filter(
          (c) => c.score >= MIN_PLAUSIBLE_SIMILARITY,
        );
        // Scores here are still against the *catalogue* title, so a deliberately
        // different search can find the right record and score it badly. Show
        // what came back either way — the human asked for these words.
        candidates = (plausible.length > 0 ? plausible : found).slice(
          0,
          CANDIDATES_SHOWN,
        );
      } catch (error) {
        console.log(`  search failed: ${error.message}`);
      }
      continue;
    }

    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= candidates.length) {
      const chosen = candidates[index - 1];
      try {
        if (await accept(entry, chosen.id, chosen.name)) return "accepted";
      } catch (error) {
        console.log(`  could not add it: ${error.message}`);
      }
      continue;
    }

    const pasted = albumIdFrom(answer);
    if (pasted) {
      try {
        const album = await getAlbum(pasted);
        console.log(
          `  ${album.name} — ${album.artists?.map((a) => a.name).join(", ")} (${album.release_date?.slice(0, 4)})`,
        );
        const yes = (await rl.question("  add this one? [Y/n] ")).trim();
        if (yes === "" || yes.toLowerCase() === "y") {
          if (await accept(entry, album.id, album.name)) return "accepted";
        }
      } catch (error) {
        console.log(`  could not fetch that album: ${error.message}`);
      }
      continue;
    }

    console.log("  didn't understand that.");
  }
}

async function main() {
  if (!existsSync(REVIEW)) {
    console.error(
      `No review pile at ${REVIEW}.\nRun \`node scripts/backfill-albums.mjs\` first.`,
    );
    process.exit(1);
  }

  const pile = JSON.parse(readFileSync(REVIEW, "utf8"));

  // The review file is a stable input, never mutated. What is still outstanding
  // is whatever it lists that the library does not yet hold — so an album added
  // in an earlier sitting simply drops out, and nothing has to be kept in sync.
  const { library } = loadGap();
  const held = new Set(library.map((a) => normalise(a.album_name)));
  let todo = pile.filter((entry) => !held.has(normalise(entry.album_name)));
  if (onlyCountries.length > 0) {
    todo = todo.filter((entry) => onlyCountries.includes(entry.country));
  }

  const done = pile.length - todo.length;
  if (todo.length === 0) {
    console.log(
      pile.length === 0
        ? "Nothing was left for review."
        : `All ${pile.length} reviewed album(s) are already in the library.`,
    );
    return;
  }
  console.log(
    `${todo.length} album(s) to review${done > 0 ? ` (${done} already done)` : ""}.`,
  );

  await authenticate();

  const tally = { accepted: 0, skipped: 0 };
  for (const [index, entry] of todo.entries()) {
    const outcome = await reviewOne(entry, `[${index + 1}/${todo.length}]`);
    if (outcome === "quit") break;
    tally[outcome] += 1;
  }

  console.log(
    `\nAdded ${tally.accepted}, skipped ${tally.skipped}, ` +
      `${todo.length - tally.accepted - tally.skipped} left untouched.`,
  );
  if (tally.accepted > 0) {
    console.log("albums.json updated — check `git diff` before committing.");
  }
}

main()
  .catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
