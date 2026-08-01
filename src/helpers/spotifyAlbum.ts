/**
 * Reading a Spotify album id out of whatever a person pasted.
 *
 * This is the whole of the Suggestion form's link validation: an input either
 * yields 22 base62 characters or it does not, and the record stores that id
 * rather than the URL. Storing the URL would mean holding a stranger's `?si=`
 * share-tracking token indefinitely for no benefit — `https://open.spotify.com/
 * album/{id}` is trivially rebuilt — and it would leave the `.validate` rule
 * nothing exact to check.
 *
 * **This module must stay import-free.** `scripts/add-community-album.ts` runs
 * under bare node, which strips types but resolves imports as plain ESM, so
 * anything this file reached for would have to resolve there too.
 */

/** Spotify ids are exactly 22 base62 characters — no hyphens, no underscores. */
const ID = /^[A-Za-z0-9]{22}$/;

/**
 * A web link, in the shapes Spotify's own share buttons produce: an optional
 * scheme, an `intl-xx` locale segment on links copied from a localised page, the
 * kind of thing being linked, the id, and then anything at all — the trailing
 * slash, the `?si=` token, a fragment.
 *
 * The host is part of the pattern on purpose. An id lifted out of some other
 * service's `/album/…` URL would look exactly like a valid Suggestion and be
 * unresolvable at accept time.
 */
const WEB_LINK =
  /^(?:https?:\/\/)?(?:open|play)\.spotify\.com\/(?:intl-[A-Za-z-]+\/)?([a-z]+)\/([A-Za-z0-9]{22})(?:[/?#]|$)/i;

/** The `spotify:album:{id}` URI the desktop app copies. */
const URI = /^spotify:([a-z]+):([A-Za-z0-9]{22})$/i;

export type AlbumIdResult =
  { ok: true; albumId: string } | { ok: false; reason: "track" | "invalid" };

export function extractAlbumId(input: string): AlbumIdResult {
  const trimmed = input.trim();

  if (ID.test(trimmed)) return { ok: true, albumId: trimmed };

  const match = WEB_LINK.exec(trimmed) ?? URI.exec(trimmed);
  if (!match) return { ok: false, reason: "invalid" };

  const kind = match[1]!.toLowerCase();
  if (kind === "album") return { ok: true, albumId: match[2]! };
  // A track link is rejected *by name*: it is the overwhelmingly likely wrong
  // paste, and "invalid link" says nothing a person can act on. Resolving it to
  // its album instead was considered and refused — a track id and an album id
  // are both 22 base62 characters, so a record that might hold either is an
  // ambiguity no rule could settle, sitting in the database for months.
  if (kind === "track") return { ok: false, reason: "track" };

  return { ok: false, reason: "invalid" };
}

/** The canonical, token-free address of an album. */
export function albumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}
