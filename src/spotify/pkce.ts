/**
 * Authorization Code with **PKCE**, the parts of it that are pure enough to
 * test.
 *
 * PKCE is the flow designed for clients that cannot keep a secret, which is
 * exactly what a static site served from GitHub Pages is. Instead of proving who
 * it is with a client secret, the app invents a one-time `code_verifier`, sends
 * only its SHA-256 hash to Spotify when it asks for a code, and sends the
 * verifier itself when it redeems that code. Anyone who intercepts the code
 * cannot use it without the verifier, and the verifier never leaves this tab.
 *
 * **The client id is not a secret and the client secret is not here.** Spotify
 * documents the id as a public identifier for this flow; `.env.example` carries
 * the warning about the other one, which nothing in `src/` reads and nothing
 * ever should. See ADR-0008.
 */

/**
 * The unreserved characters RFC 7636 allows in a verifier. Base62 plus the four
 * marks, so nothing here ever needs escaping in a form body.
 */
const VERIFIER_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * A random string from `VERIFIER_CHARS`, drawn from the platform CSPRNG.
 *
 * Used for both halves of the flow: the `code_verifier` (43–128 characters, so
 * the default of 64 sits comfortably inside) and the `state` that ties a reply
 * back to the request that asked for it.
 */
export function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // A modulo over 256 is very slightly biased towards the first 64 characters,
  // which is irrelevant here: this is unguessability, not a key.
  return Array.from(bytes, (byte) => VERIFIER_CHARS[byte % 64]!).join("");
}

/** Base64url — base64 with the two URL-unsafe characters swapped and no padding. */
function base64url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * The `code_challenge` for a verifier: base64url of its SHA-256 digest.
 *
 * Asynchronous because WebCrypto is, which is the one awkward thing about this
 * flow — the popup has to be opened *before* this resolves or the browser stops
 * treating it as something the reviewer asked for. See `useSpotifyAuth`.
 */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(digest);
}

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}

/**
 * Where to send the reviewer to authorise.
 *
 * **No scopes are asked for.** Reading an album from the catalogue needs a valid
 * user token and nothing more, so this requests no access to anybody's account —
 * not their library, not their playlists, not what they are listening to. The
 * consent screen says so, which is the point of asking for nothing.
 */
export function authorizeUrl(request: AuthorizeRequest): string {
  const params = new URLSearchParams({
    client_id: request.clientId,
    response_type: "code",
    redirect_uri: request.redirectUri,
    state: request.state,
    code_challenge_method: "S256",
    code_challenge: request.challenge,
    scope: "",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** What Spotify sent back, either way round. */
export type CallbackResult =
  | { ok: true; code: string; state: string }
  /** `access_denied` when the reviewer said no; anything else is Spotify's. */
  | { ok: false; error: string; state: string };

/**
 * Read a reply out of a query string, or `null` when there isn't one — which is
 * every ordinary load of the app, and is why this has to be cheap and silent.
 */
export function readCallback(search: string): CallbackResult | null {
  const params = new URLSearchParams(search);
  const state = params.get("state");
  const code = params.get("code");
  const error = params.get("error");

  if (state === null) return null;
  if (code !== null) return { ok: true, code, state };
  if (error !== null) return { ok: false, error, state };
  return null;
}

export interface TokenRequest {
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
}

/**
 * Redeem a code for an access token.
 *
 * The verifier goes up here and nowhere else, and there is no `client_secret`
 * field — that is the whole substitution PKCE makes. Spotify's token endpoint
 * allows cross-origin requests for public clients, so this is a plain `fetch`
 * from the page with nothing in front of it.
 *
 * A refresh token comes back with it and is deliberately **thrown away**. It is
 * a long-lived credential, and the alternative to keeping one is a button: an
 * access token lasts an hour, a review sitting rarely does, and reconnecting
 * costs one click because Spotify still has the session.
 */
export async function exchangeCode(
  request: TokenRequest,
): Promise<{ token: string; expiresInSeconds: number }> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: request.clientId,
      code_verifier: request.verifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Spotify refused the code (${response.status})`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) throw new Error("Spotify returned no access token");

  return {
    token: body.access_token,
    expiresInSeconds: body.expires_in ?? 3600,
  };
}
