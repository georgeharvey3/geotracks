import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type {
  AcceptOptions,
  AcceptOutcome,
  Admin,
  AdminAccess,
  SignInOutcome,
  StoredSuggestion,
} from "../hooks/useAdmin";

/**
 * Stateful fake for the `useAdmin` seam, built like `leaderboardFake` and
 * beside `suggestionFake`.
 *
 * It stands in for three things a test cannot have: a Google popup, a
 * server-side rule deciding whether this account may read, and — since ADR-0008
 * — Spotify's catalogue and the write that accepts. The first two are set
 * directly (`signedOut()`, `denied()`, `allowed([...])`) because the states they
 * produce are the whole of what the screen is; accepting behaves like the real
 * thing by default (the Suggestion leaves the queue) and can be told to fail the
 * ways it really fails.
 */

const USER = { uid: "admin-uid", email: "curator@example.com" };

let access: AdminAccess = { state: "signed-out" };
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

function getSnapshot(): AdminAccess {
  return access;
}

/** What the next sign-in will answer with. Success unless a test says otherwise. */
let nextSignIn: Extract<SignInOutcome, { ok: false }> | null = null;

const signIn = vi.fn(async (): Promise<SignInOutcome> => {
  if (nextSignIn) return nextSignIn;
  access = { state: "allowed", user: USER, suggestions: [] };
  notify();
  return { ok: true };
});

const signOut = vi.fn(async () => {
  access = { state: "signed-out" };
  notify();
});

const reject = vi.fn(async (key: string) => {
  if (access.state === "allowed") {
    access = {
      ...access,
      suggestions: access.suggestions.filter(
        (suggestion) => suggestion.key !== key,
      ),
    };
    notify();
  }
});

/** What the next accept will answer with. Success by default, as it usually is. */
let nextOutcome: AcceptOutcome | null = null;

const accept = vi.fn(
  async (
    suggestion: StoredSuggestion,
    options: AcceptOptions,
  ): Promise<AcceptOutcome> => {
    if (nextOutcome && !nextOutcome.ok) return nextOutcome;

    // The real thing deletes the Suggestion in the same write that stores the
    // album, so an accepted one leaves the queue rather than being marked in it.
    if (access.state === "allowed") {
      access = {
        ...access,
        suggestions: access.suggestions.filter(
          (entry) => entry.key !== suggestion.key,
        ),
      };
      notify();
    }

    return {
      ok: true,
      album: {
        country: "Taiwan",
        album_name: "Aboriginal Folk Songs of Taiwan",
        tracks: ["https://open.spotify.com/track/1111111111111111111111"],
        liveFrom: options.liveFrom,
        suggestion: suggestion.key,
      },
    };
  },
);

export const adminControl = {
  signIn,
  signOut,
  reject,
  accept,
  /**
   * Make the next sign-in be refused. `cancelled` is the reviewer closing the
   * popup, which the screen must not report as a fault.
   */
  signInFails: (code: string, cancelled = false) => {
    nextSignIn = { ok: false, code, cancelled };
  },
  /** Make the next accept fail the way the real one can. */
  acceptFails: (outcome: Extract<AcceptOutcome, { ok: false }>) => {
    nextOutcome = outcome;
  },
  /** The keys accepted so far, with the switch-on date each was given. */
  accepted: (): { key: string; liveFrom: string }[] =>
    accept.mock.calls.map(([suggestion, options]) => ({
      key: suggestion.key,
      liveFrom: options.liveFrom,
    })),
  /** Nobody named signed in — every player, and the screen's opening state. */
  signedOut: () => {
    access = { state: "signed-out" };
    notify();
  },
  /** Signed in, with the first read not yet answered. */
  checking: () => {
    access = { state: "checking", user: USER };
    notify();
  },
  /** Signed in as an account the rules refuse. */
  denied: (uid = "somebody-else") => {
    access = { state: "denied", user: { uid, email: "them@example.com" } };
    notify();
  },
  /** Signed in as the account the rules allow, holding these Suggestions. */
  allowed: (suggestions: StoredSuggestion[]) => {
    access = { state: "allowed", user: USER, suggestions };
    notify();
  },
  /** The keys rejected so far, in order. */
  rejected: (): string[] => reject.mock.calls.map(([key]) => key),
  reset: () => {
    access = { state: "signed-out" };
    nextOutcome = null;
    nextSignIn = null;
    signIn.mockClear();
    signOut.mockClear();
    reject.mockClear();
    accept.mockClear();
    notify();
  },
};

// Mock implementation swapped in for the default export of useAdmin.
export default function useAdminFake(): Admin {
  return {
    access: useSyncExternalStore(subscribe, getSnapshot),
    signIn,
    signOut,
    reject,
    accept,
  };
}
