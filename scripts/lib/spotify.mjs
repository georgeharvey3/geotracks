// The Spotify Web API, as much of it as the album backfill needs.
//
// Client-credentials only: no user, no redirect, no scopes. That rules out
// anything user-specific, which is fine — everything here is public catalogue
// data.
//
// Credentials come from $SPOTIFY_CLIENT_ID and $SPOTIFY_CLIENT_SECRET. These
// are REAL SECRETS, unlike the repo's VITE_FIREBASE_* values: keep them out of
// `.env` and out of any VITE_-prefixed variable, or Vite will inline them into
// the browser bundle. Export them in the shell instead.
//
// Two endpoints this deliberately does not use, both established by probing a
// live token (see issue #41):
//   GET /albums?ids=   403s outright for a client-credentials token, for a
//                      reason no page of Spotify's documentation accounts for
//   album.label        gone. Spotify marks it deprecated and no longer returns
//                      it even on the full album object, so a match cannot be
//                      corroborated by its record label any more

const SEARCH_LIMIT = 10;
const PAGE_SIZE = 50;

// Spotify's rate limit is a rolling 30-second window whose size it does not
// publish, and a new app sits in development mode, where it is lower. A short
// pause between albums keeps a 145-album run under it; 429s are still handled
// below, because the limit also counts whatever else the account did.
export const PAUSE_MS = 120;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let accessToken = null;

export async function authenticate() {
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
export async function api(path, attempt = 0) {
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

/** Album search hits for a free-text query. These are *simplified* albums. */
export async function searchAlbums(query) {
  const body = await api(
    `search?q=${encodeURIComponent(query)}&type=album&limit=${SEARCH_LIMIT}`,
  );
  return body.albums?.items ?? [];
}

/** One album by id, for a link a human pasted in rather than a search hit. */
export function getAlbum(albumId) {
  return api(`albums/${albumId}`);
}

/** Every track URL on an album, following Spotify's pagination to the end. */
export async function trackUrls(albumId) {
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
 * The album id inside whatever a human pasted: an open.spotify.com link, a
 * `spotify:album:` URI, or the bare id. Null if it is none of those — which is
 * how the review prompt tells a link from a command.
 */
export function albumIdFrom(input) {
  const text = input.trim();
  const match =
    text.match(/album[/:]([A-Za-z0-9]{22})/) ??
    text.match(/^([A-Za-z0-9]{22})$/);
  return match ? match[1] : null;
}
