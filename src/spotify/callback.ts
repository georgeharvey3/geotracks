/**
 * The other end of the Spotify sign-in: what runs when the popup comes back.
 *
 * Spotify redirects to a URI registered against the app, and a registered URI
 * cannot carry a fragment — so the reply lands on the site's own base URL, which
 * is the app's `index.html`. **A whole GeoTracks would boot inside a 480px popup
 * window** if nothing stopped it: a second map, a second Spotify embed, a second
 * anonymous sign-in, all of it thrown away a moment later. So the very first
 * thing `index.tsx` does is ask whether this document is that popup, and if it
 * is, it answers its opener and closes without rendering anything.
 *
 * A popup rather than a full-page redirect because the review screen is a *queue
 * being worked*. A redirect would tear the app down mid-review and come back to
 * a fresh menu with a code in the address bar, which then needs the app to know
 * about a query parameter it otherwise has no business reading. This way the one
 * document that reads the URL is the one that exists only to read it. See
 * ADR-0008.
 */

import { readCallback, type CallbackResult } from "./pkce";

/** Names this app's message, so the opener ignores everything else on the bus. */
export const AUTH_MESSAGE = "geotracks:spotify-auth";

export interface AuthMessage {
  source: typeof AUTH_MESSAGE;
  result: CallbackResult;
}

/**
 * Answer the opener and close, when this document is the sign-in popup.
 * Returns whether it was — `true` means do not render the app.
 *
 * The reply is posted to **this origin** rather than `*`: the popup is the app's
 * own page, so its opener is the app, and an authorization code is exactly the
 * kind of thing not to broadcast to whatever else might be listening.
 *
 * Everything about this is best-effort. A window that will not close (a tab
 * somebody opened by hand at this URL, which no script may close) still stops
 * here rather than booting a duplicate app, and the reviewer closes it. The
 * opener has its own timeout for a popup that never speaks.
 */
export function completeSpotifyAuth(): boolean {
  const opener = window.opener as Window | null;
  if (!opener || opener === window) return false;

  const result = readCallback(window.location.search);
  if (!result) return false;

  const message: AuthMessage = { source: AUTH_MESSAGE, result };
  try {
    opener.postMessage(message, window.location.origin);
  } catch {
    // An opener from another origin, or one already gone. Nothing to say to it.
  }
  window.close();
  return true;
}
