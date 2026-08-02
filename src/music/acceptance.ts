/**
 * Turning a Suggestion into a Community album: the rules both things that can
 * do it have to agree on.
 *
 * There are now two — `scripts/add-community-album.ts` in a terminal and the
 * review screen in a browser (ADR-0008) — and the ways they could quietly
 * disagree are the ways that matter most. A duplicate the screen misses and the
 * script catches puts the same album in the Library twice; a `liveFrom` the two
 * default differently lands an album in Competition on a day the other would not
 * have. Neither shows up as an error anywhere. So the rules live here once, and
 * the two callers differ only in where they get their album from and how they
 * write it.
 *
 * **This module must stay import-free**, like `src/helpers/spotifyAlbum.ts` and
 * for the same reason: the script runs under bare node, which strips
 * TypeScript's types but resolves imports as plain ESM, so anything reached for
 * here would have to resolve there too. The type-only import below is erased
 * outright and never resolved by either.
 */

import type { CommunityAlbum, LibraryAlbum } from "../types";

/**
 * The day after `date`, device-local, as `YYYY-MM-DD`.
 *
 * This is the default switch-on date, and being *tomorrow* is the whole of what
 * makes it safe: `liveFrom` is authored ahead of the moment of acceptance so
 * that nobody anywhere has passed it yet, and every player crosses it at their
 * own local midnight. An album accepted with today's date would join Competition
 * part-way through a day somebody is already playing, which is the one thing
 * `competitionAlbums` exists to prevent.
 */
export function nextDay(date: Date): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  const month = `${next.getMonth() + 1}`.padStart(2, "0");
  const day = `${next.getDate()}`.padStart(2, "0");
  return `${next.getFullYear()}-${month}-${day}`;
}

/**
 * A track URL as the Library stores them: `https://open.spotify.com/track/{id}`
 * and nothing after it.
 *
 * All 785 Folkways albums use that bare form, and the Library must not develop a
 * second dialect — duplicate detection below is by exact string, so one album
 * carrying `?si=` tokens would be invisible to the check that stops it being
 * added twice. Spotify's own `external_urls` carry no query today; anything that
 * ever did is cut off here.
 */
export function cleanTrackUrl(url: string): string {
  return url.split(/[?#]/)[0]!;
}

/**
 * The first of `tracks` the Library already holds, and the album holding it —
 * or `null` when none of them are.
 *
 * **Matched on track URL rather than album id**, because `albums.json` holds no
 * album ids at all, across either half of the Library. A track already present
 * means this is a re-submission of a record already in, whatever it is called
 * this time, and the album it names is what the person accepting needs told.
 */
export function heldTrack(
  tracks: string[],
  library: LibraryAlbum[],
): { track: string; albumName: string } | null {
  const held = new Map<string, string>();
  for (const album of library) {
    for (const track of album.tracks) held.set(track, album.album_name);
  }

  for (const track of tracks) {
    const albumName = held.get(track);
    if (albumName !== undefined) return { track, albumName };
  }
  return null;
}

/** What both callers have gathered by the time an album can be built. */
export interface AcceptedAlbum {
  /** The country **name**: the Library joins by name, not by alpha-2 code. */
  country: string;
  albumName: string;
  /** Track URLs in album order, already cleaned. */
  tracks: string[];
  liveFrom: string;
  /** The `suggestions/{pushId}` it came from, when it came from one. */
  suggestion?: string | undefined;
}

/**
 * The record as it goes into `communityAlbums/{pushId}`.
 *
 * `suggestion` is set only when there was one — an album added by hand has no
 * key to record — and RTDB rejects an explicit `undefined` in a write, so it is
 * spread in rather than assigned.
 */
export function communityAlbumFrom(accepted: AcceptedAlbum): CommunityAlbum {
  return {
    country: accepted.country,
    album_name: accepted.albumName,
    tracks: accepted.tracks,
    liveFrom: accepted.liveFrom,
    ...(accepted.suggestion ? { suggestion: accepted.suggestion } : {}),
  };
}
