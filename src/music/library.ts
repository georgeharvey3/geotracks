import albumsJSON from "../albums.json";
import communityAlbumsJSON from "../community-albums.json";
import { CommunityAlbum, LibraryAlbum } from "../types";

// An *assignment*, not a cast. The file ships empty, which TypeScript reads as
// `never[]` — every property access on it is an error, including the one below.
// Naming the type here fixes that, and unlike `as` it stays a real check: the
// day the file has entries in it, a malformed one fails the build.
const communityAlbums: CommunityAlbum[] = communityAlbumsJSON;

/**
 * The **Library**: every Album the app holds, whatever its origin. Explore and
 * Infinite draw from this, and it is the thing a Suggestion asks to be let into.
 *
 * It is two files because `albums.json` carries a claim worth keeping true —
 * every entry in it came from the Smithsonian Folkways Archive, catalogued by
 * hand. Appending Community albums to it would make that claim quietly false
 * and unseparable forever, so **the filename is the provenance record** and
 * `Album` gains no `source` field: every consumer of an Album would otherwise
 * grow an optional field it has to decide to ignore.
 *
 * **This module owns the union, and nothing else imports a raw album JSON.**
 * Leaving `gameReducer`, `exploreReducer` and the tests to concatenate for
 * themselves means four places to keep in step, and the failure mode when one is
 * missed is Explore offering a country the game's pool has never heard of.
 */
export const library: LibraryAlbum[] = [...albumsJSON, ...communityAlbums];

/**
 * The `suggestions/{pushId}` keys already accepted, recorded on the albums they
 * became. This is the only record there is: nothing is ever written back to the
 * database, so an accepted Suggestion looks exactly like a new one until it is
 * matched against this.
 *
 * It reads a raw album JSON, which is this module's job and nobody else's — the
 * review screen asks the Library "have I dealt with this?" rather than opening
 * the file for itself.
 */
export const acceptedSuggestionKeys: ReadonlySet<string> = new Set(
  communityAlbums
    .map((album) => album.suggestion)
    .filter((key): key is string => key !== undefined),
);

/**
 * The Library as Competition may see it on a given day, `today` being the
 * device-local `YYYY-MM-DD` (`dayString`). Folkways albums carry no `liveFrom`
 * and are always in; a **Community album is in only once the day has passed the
 * date it names**.
 *
 * **This is load-bearing and is not dead weight.** `getDailySongs` seeds off the
 * calendar date and then draws *by array index*, splicing as it goes, and
 * `createInitialState` re-derives the day's ten from the current pool on every
 * page load. So adding one album anywhere changes every date's sequence, and a
 * deploy mid-day would break two things at once: two players on the same day
 * would play different Daily Songs onto the same leaderboard, and a single
 * player resuming an unfinished Run would find the six turns ahead of them drawn
 * from a sequence their first four were never part of.
 *
 * `liveFrom` is a **switch-on date, not a provenance date**, and is authored
 * *ahead* of the release — the day after the intended one. The comparison is
 * strict, so the album waits out the whole of the date it names: at the moment
 * of a release nobody anywhere on earth has passed it yet, and each player
 * crosses it at their own local midnight, the same boundary the Daily Run
 * already rolls over on.
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
