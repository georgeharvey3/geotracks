/**
 * Reading an album out of Spotify's catalogue, from the browser.
 *
 * This is the thing that could not be done here until ADR-0008, and the reason
 * accepting a Suggestion was a command to copy rather than a button: oEmbed —
 * which the rows and `useSpotifyPlayer` both use, free and credential-free —
 * gives a title and a cover and **no tracks**, and an album with no tracks is
 * not an Album. The catalogue API has the tracks and wants a token. It is now
 * given one that belongs to the reviewer rather than to the app (see
 * `useSpotifyAuth`), which is what keeps the client secret out of the bundle.
 *
 * Mirrors what `scripts/add-community-album.ts` does with its own token, down to
 * the paging; the rules about what a track URL looks like and what counts as a
 * duplicate are shared rather than mirrored, in `src/music/acceptance.ts`.
 */

import { cleanTrackUrl } from "../music/acceptance";

interface SpotifyTrack {
  id: string;
  external_urls?: { spotify?: string };
}

interface SpotifyAlbumPayload {
  name: string;
  artists: { name: string }[];
  tracks: { items: SpotifyTrack[]; next: string | null };
}

/** An album as the review screen needs it: enough to write, and to show. */
export interface CatalogueAlbum {
  name: string;
  /** Every artist on the album, joined — for confirming what is being accepted. */
  artists: string;
  /** Track URLs in album order, cleaned. */
  tracks: string[];
}

export type CatalogueResult =
  | { ok: true; album: CatalogueAlbum }
  /** The token has expired or was rejected: reconnect and try again. */
  | { ok: false; reason: "unauthorized" }
  /** Spotify has no such album, or it is unavailable in this market. */
  | { ok: false; reason: "missing" }
  /** Offline, rate-limited, or Spotify having a bad day. */
  | { ok: false; reason: "failed" };

async function getJSON<T>(
  url: string,
  token: string,
): Promise<
  | { ok: true; body: T }
  | { ok: false; reason: "unauthorized" | "missing" | "failed" }
> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  // 401 is a token that has run out — an hour is shorter than some review
  // sittings — and 403 is one that was never allowed. Both are answered by
  // connecting again, so they are one state to the screen.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status === 404) return { ok: false, reason: "missing" };
  if (!response.ok) return { ok: false, reason: "failed" };

  return { ok: true, body: (await response.json()) as T };
}

/**
 * One album and all of its tracks.
 *
 * Albums over 50 tracks arrive paged, and a Folkways-shaped compilation reaching
 * that is entirely ordinary — so the pages are followed rather than assumed
 * away. A partial track list would be worse than a failure: it writes a real
 * album into the Library that is quietly missing its second half.
 */
export async function fetchAlbum(
  albumId: string,
  token: string,
): Promise<CatalogueResult> {
  const first = await getJSON<SpotifyAlbumPayload>(
    `https://api.spotify.com/v1/albums/${albumId}`,
    token,
  );
  if (!first.ok) return first;

  const payload = first.body;
  const items = [...payload.tracks.items];
  let next = payload.tracks.next;
  while (next) {
    const page = await getJSON<{ items: SpotifyTrack[]; next: string | null }>(
      next,
      token,
    );
    if (!page.ok) return page;
    items.push(...page.body.items);
    next = page.body.next;
  }

  const tracks = items.map((track) =>
    cleanTrackUrl(
      track.external_urls?.spotify ??
        `https://open.spotify.com/track/${track.id}`,
    ),
  );
  if (tracks.length === 0) return { ok: false, reason: "missing" };

  return {
    ok: true,
    album: {
      name: payload.name,
      artists: payload.artists.map((artist) => artist.name).join(", "),
      tracks,
    },
  };
}
