import { useCallback, useEffect, useRef, useState } from "react";

import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI } from "../config";
import { AUTH_MESSAGE, type AuthMessage } from "../spotify/callback";
import {
  authorizeUrl,
  challengeFor,
  exchangeCode,
  randomString,
} from "../spotify/pkce";

/** How long a popup may sit unanswered before the screen stops waiting on it. */
const ABANDONED_AFTER_MS = 3 * 60 * 1000;

export type SpotifyAccess =
  /** No client id in this build: nothing to sign in against. */
  | { state: "unconfigured" }
  | { state: "disconnected" }
  /** The popup is open and the reviewer is deciding. */
  | { state: "connecting" }
  /** They said no, the popup was blocked, or the exchange failed. */
  | { state: "refused"; reason: string }
  | { state: "connected"; token: string };

export interface SpotifyAuth {
  access: SpotifyAccess;
  connect: () => void;
  disconnect: () => void;
}

/**
 * The reviewer's own Spotify session, for reading album track lists.
 *
 * **This is a second sign-in, and it is a different question from the first
 * one.** Google says who may see the Suggestions; Spotify says nothing about
 * permission at all — it is only how a page with no client secret gets to ask
 * the catalogue what is on an album (ADR-0008). No scopes are requested, so it
 * grants no access to the reviewer's account, and a reviewer who never connects
 * can still read and reject the queue.
 *
 * **The token is held in memory and nowhere else.** Not `localStorage`, which
 * `useDailyRun` is deliberately the app's only user of, and not `sessionStorage`
 * either: an access token is a credential, it lasts an hour, and a reload costs
 * one click to replace because Spotify still has the session. Nothing about this
 * survives the tab, which is the right lifetime for it.
 */
export default function useSpotifyAuth(): SpotifyAuth {
  const [access, setAccess] = useState<SpotifyAccess>(
    SPOTIFY_CLIENT_ID ? { state: "disconnected" } : { state: "unconfigured" },
  );

  // Everything in flight, kept out of state because none of it is rendered and
  // the message listener must see the current value rather than the one that
  // existed when it was attached.
  const pending = useRef<{
    verifier: string;
    state: string;
    popup: Window | null;
    abandon: ReturnType<typeof setTimeout>;
  } | null>(null);

  const settle = useCallback((next: SpotifyAccess) => {
    if (pending.current) {
      clearTimeout(pending.current.abandon);
      pending.current.popup?.close();
      pending.current = null;
    }
    setAccess(next);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // The popup is this app's own page, so anything from elsewhere is not the
      // reply — and an authorization code is not a thing to take on trust.
      if (event.origin !== window.location.origin) return;
      const message = event.data as AuthMessage | undefined;
      if (!message || message.source !== AUTH_MESSAGE) return;

      const inFlight = pending.current;
      // `state` is the whole of CSRF protection here: a reply that does not name
      // the request we made is one we did not make.
      if (!inFlight || message.result.state !== inFlight.state) return;

      if (!message.result.ok) {
        settle({
          state: "refused",
          reason:
            message.result.error === "access_denied"
              ? "Sign-in was cancelled."
              : `Spotify refused the sign-in (${message.result.error}).`,
        });
        return;
      }

      const { code } = message.result;
      const { verifier } = inFlight;
      exchangeCode({
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri: SPOTIFY_REDIRECT_URI,
        code,
        verifier,
      }).then(
        ({ token }) => settle({ state: "connected", token }),
        () =>
          settle({
            state: "refused",
            reason:
              "Spotify wouldn't complete the sign-in. Check that this exact " +
              `address is a registered redirect URI: ${SPOTIFY_REDIRECT_URI}`,
          }),
      );
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (pending.current) clearTimeout(pending.current.abandon);
    };
  }, [settle]);

  const connect = useCallback(() => {
    if (!SPOTIFY_CLIENT_ID) return;

    // **Opened before the challenge is computed, not after.** Hashing the
    // verifier is asynchronous, and a `window.open` on the far side of an await
    // has lost its claim to have been asked for by a person — Safari and Firefox
    // block it. So an empty popup is opened inside the click and pointed at
    // Spotify a moment later.
    const popup = window.open(
      "",
      "geotracks-spotify-auth",
      "width=520,height=760,noopener=no",
    );
    if (!popup) {
      setAccess({
        state: "refused",
        reason: "The sign-in window was blocked. Allow popups for this site.",
      });
      return;
    }

    const verifier = randomString();
    const state = randomString(16);
    setAccess({ state: "connecting" });

    challengeFor(verifier).then(
      (challenge) => {
        pending.current = {
          verifier,
          state,
          popup,
          // A popup that is closed rather than answered says nothing at all, and
          // there is no reliable event for it. Rather than poll a window this
          // tab is about to lose track of, the screen simply stops waiting.
          abandon: setTimeout(
            () =>
              settle({
                state: "refused",
                reason: "The sign-in window didn't come back. Try again.",
              }),
            ABANDONED_AFTER_MS,
          ),
        };
        popup.location.href = authorizeUrl({
          clientId: SPOTIFY_CLIENT_ID,
          redirectUri: SPOTIFY_REDIRECT_URI,
          state,
          challenge,
        });
      },
      () => {
        popup.close();
        setAccess({
          state: "refused",
          reason: "This browser wouldn't prepare the sign-in.",
        });
      },
    );
  }, [settle]);

  const disconnect = useCallback(() => {
    settle(
      SPOTIFY_CLIENT_ID ? { state: "disconnected" } : { state: "unconfigured" },
    );
  }, [settle]);

  return { access, connect, disconnect };
}
