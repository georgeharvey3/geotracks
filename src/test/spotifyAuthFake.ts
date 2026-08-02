import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { SpotifyAccess, SpotifyAuth } from "../hooks/useSpotifyAuth";

/**
 * Stateful fake for the `useSpotifyAuth` seam, built like `adminFake` beside it.
 *
 * It stands in for the one thing a test can least have: a popup window
 * negotiating OAuth with a third party. What the review screen actually depends
 * on is only which of five states that negotiation is in, so the states are set
 * directly and the token is a string.
 *
 * The default is **disconnected**, not connected: a reviewer arriving on the
 * screen has not signed in to Spotify, and the queue has to be readable and
 * rejectable in that state.
 */

const TOKEN = "a-spotify-access-token";

let access: SpotifyAccess = { state: "disconnected" };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SpotifyAccess {
  return access;
}

const connect = vi.fn(() => {
  access = { state: "connected", token: TOKEN };
  notify();
});

const disconnect = vi.fn(() => {
  access = { state: "disconnected" };
  notify();
});

export const spotifyAuthControl = {
  connect,
  disconnect,
  token: TOKEN,
  /** Signed in to Google but not to Spotify — the screen's opening state. */
  disconnected: () => {
    access = { state: "disconnected" };
    notify();
  },
  connecting: () => {
    access = { state: "connecting" };
    notify();
  },
  connected: () => {
    access = { state: "connected", token: TOKEN };
    notify();
  },
  refused: (reason = "Sign-in was cancelled.") => {
    access = { state: "refused", reason };
    notify();
  },
  /** A build with no client id: there is nothing to sign in against. */
  unconfigured: () => {
    access = { state: "unconfigured" };
    notify();
  },
  reset: () => {
    access = { state: "disconnected" };
    connect.mockClear();
    disconnect.mockClear();
    notify();
  },
};

// Mock implementation swapped in for the default export of useSpotifyAuth.
export default function useSpotifyAuthFake(): SpotifyAuth {
  return {
    access: useSyncExternalStore(subscribe, getSnapshot),
    connect,
    disconnect,
  };
}
