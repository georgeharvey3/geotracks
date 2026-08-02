import albumsJSON from "../albums.json";
import { Album, LibraryAlbum } from "../types";

/**
 * The **bundled** half of the Library, and the only half that ships with the
 * app: every Album catalogued by hand from the Smithsonian Folkways Archive.
 *
 * It stays a static asset for a reason that is about size and mutability rather
 * than trust — 785 albums and 12,111 track URLs, 0.91 MB raw and 245 KB gzipped
 * behind a content hash the CDN caches indefinitely. Read from the database
 * instead, that is most of a megabyte fetched on every session, uncached and
 * metered. The half that changes is the small one (ADR-0007).
 *
 * The filename is also the provenance record, which is why `Album` gains no
 * `source` field: every entry here came from Folkways, and nothing else does.
 */
export const bundledAlbums: Album[] = albumsJSON;

/**
 * The **Library**: every Album the app holds, bundled and live together. This is
 * what Explore and Infinite draw from, and what a Suggestion asks to be let
 * into.
 *
 * Live albums go **after** the bundled ones and arrive already ordered by their
 * push key. Both halves of that matter, and not only for tidiness: the daily
 * seed draws by index into this array, so two players are owed the same set in
 * the same order (see `competitionAlbums`).
 */
export function libraryWith(liveAlbums: LibraryAlbum[]): LibraryAlbum[] {
  return [...bundledAlbums, ...liveAlbums];
}

/**
 * The Library as Competition may see it on a given day, `today` being the
 * device-local `YYYY-MM-DD` (`dayString`). Bundled albums carry no `liveFrom`
 * and are always in; a **Community album is in only once the day has passed the
 * date it names**.
 *
 * **This is load-bearing and is not dead weight.** `getDailySongs` seeds off the
 * calendar date and then draws *by array index*, splicing as it goes, and
 * `createInitialState` re-derives the day's ten from the current pool on every
 * page load. What the seed is owed is therefore narrow and absolute: **the same
 * set, in the same order, for every player on that date, and no change to it
 * once the date has begun.** Without that, two players on one day play different
 * Daily Songs onto the same leaderboard, and a player resuming an unfinished Run
 * gets the six turns ahead of them from a sequence their first four were never
 * part of.
 *
 * A bundled file gets that by being immutable between deploys. A database record
 * gets it from this gate: an album is accepted into Explore and Infinite at
 * once, and joins Competition only when every player has crossed its `liveFrom`
 * at their own local midnight. `liveFrom` is a **switch-on date, not a
 * provenance date**, authored a day ahead so that nobody anywhere has passed it
 * at the moment it is written.
 *
 * The corollary is a discipline no code here can enforce: **an album whose
 * `liveFrom` has passed is frozen.** Editing or deleting one changes this
 * array's length and order for anyone loading afterwards, and hands them a
 * different day.
 *
 * The date is an **argument, not the clock**. `vi.setSystemTime` moves the daily
 * seed with it and no test may assert which Songs a day yields, so a function
 * that read `new Date()` here could only be tested the one way the suite
 * forbids.
 */
export function competitionAlbums(
  albums: LibraryAlbum[],
  today: string,
): LibraryAlbum[] {
  // `YYYY-MM-DD` sorts lexicographically, so this is the date comparison.
  return albums.filter(
    (album) => !("liveFrom" in album) || album.liveFrom < today,
  );
}
