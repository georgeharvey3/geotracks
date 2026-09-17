/**
 * The page's one handshake with the Spotify IFrame API.
 *
 * The API script announces itself by calling `window.onSpotifyIframeApiReady`,
 * and it does that **once, whenever it finishes loading**. It is `async` in
 * `index.html`, so when that happens is not ours to choose — and a callback
 * registered by a player's effect is only there to hear it if a player happens
 * to be mounted at that moment. The app has two ways to miss it:
 *
 * - **Nobody is on a map surface yet.** The menu mounts no player, and
 *   Competition holds the player there until the live half of the Library
 *   arrives (ADR-0007), so the one mode with a wait in front of it is the one
 *   most likely to still be on the menu when the script lands. The announcement
 *   goes nowhere, and the game screen that follows never gets a controller: its
 *   Clip sits on the spinner and then reports a load failure, while Infinite —
 *   which can be entered the instant the menu paints — plays normally. A
 *   playback bug that belongs to one game mode is really this race, and the
 *   mode is only which button makes you wait.
 * - **A second screen in the same session.** The API object went into the first
 *   player's ref and left with it; the next one registers a callback that has
 *   already been called.
 *
 * So the handshake belongs to the page and not to whichever component is on
 * screen: it is caught once, here, and handed to every player that asks
 * afterwards — including the ones that ask long after it arrived.
 */

type Listener = (api: SpotifyIFrameAPI) => void;

/** The API, once the page has it. Null until the script announces itself. */
let iframeApi: SpotifyIFrameAPI | null = null;

/** Players waiting for it, each to be told exactly once. */
const waiting = new Set<Listener>();

function announce(api: SpotifyIFrameAPI): void {
  iframeApi = api;
  const listeners = [...waiting];
  waiting.clear();
  listeners.forEach((listener) => listener(api));
}

// Taken over at import time, which is as early as this bundle can be: the app
// statically imports the player, so this runs while the page is still booting.
// `index.html` holds the same door open for the one case that beats even that —
// a cached script landing before the bundle has evaluated — by stashing the API
// where this can find it.
if (typeof window !== "undefined") {
  if (window.spotifyIFrameApi) announce(window.spotifyIFrameApi);
  window.onSpotifyIframeApiReady = announce;
}

/**
 * Call `listener` with the IFrame API, now if the page already holds it and
 * otherwise as soon as it arrives. Returns an unsubscribe for a caller that
 * goes away while still waiting.
 */
export function whenIFrameApi(listener: Listener): () => void {
  if (iframeApi) {
    listener(iframeApi);
    return () => {};
  }

  waiting.add(listener);
  return () => waiting.delete(listener);
}

/**
 * Forget the handshake, as if the script had never loaded.
 *
 * Only a test has any use for this. The announcement happens once per page, so
 * a test that needs the state *before* it — which is the whole of the bug this
 * module exists for — has no other way back to it.
 */
export function forgetIFrameApi(): void {
  iframeApi = null;
  waiting.clear();
}
