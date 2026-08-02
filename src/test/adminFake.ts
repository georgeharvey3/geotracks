import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { Admin, AdminAccess, StoredSuggestion } from "../hooks/useAdmin";

/**
 * Stateful fake for the `useAdmin` seam, built like `leaderboardFake` and
 * beside `suggestionFake`.
 *
 * It stands in for two things a test cannot have: a Google popup, and a
 * server-side rule deciding whether this account may read. Both are set
 * directly — `signedOut()`, `denied()`, `allowed([...])` — because the states
 * they produce are the whole of what the screen is.
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

const signIn = vi.fn(async () => {
  access = { state: "allowed", user: USER, suggestions: [] };
  notify();
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

export const adminControl = {
  signIn,
  signOut,
  reject,
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
    signIn.mockClear();
    signOut.mockClear();
    reject.mockClear();
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
  };
}
