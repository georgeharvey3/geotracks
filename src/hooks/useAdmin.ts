import { useCallback, useEffect, useState } from "react";
import { onValue, ref, remove } from "firebase/database";

import {
  db,
  signInWithGoogle,
  signOutNamed,
  watchNamedUser,
} from "../firebase";

/** One `suggestions/{pushId}`, as the form wrote it, with its key. */
export interface StoredSuggestion {
  key: string;
  albumId: string;
  countryCode: string;
  note?: string;
  uid: string;
  createdAt: number;
}

/** Who is signed in, as the admin screen needs to know it. */
export interface AdminUser {
  uid: string;
  email: string | null;
}

export type AdminAccess =
  /** Nobody named is signed in. */
  | { state: "signed-out" }
  /** Signed in, waiting on the first read to say whether it is allowed. */
  | { state: "checking"; user: AdminUser }
  /** Signed in as somebody the rules do not let read. */
  | { state: "denied"; user: AdminUser }
  | { state: "allowed"; user: AdminUser; suggestions: StoredSuggestion[] };

export interface Admin {
  access: AdminAccess;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Delete one Suggestion. Resolves when it is gone, rejects if it is not. */
  reject: (key: string) => Promise<void>;
}

/**
 * The Suggestion review seam: who is signed in, what they may read, and the one
 * destructive thing they may do.
 *
 * **The permission lives in the rules, not here.** Nothing in this file knows
 * which uid is allowed — it subscribes and finds out, and `denied` is simply
 * what a `PERMISSION_DENIED` error from RTDB is called on the way back. That is
 * deliberate: a uid compiled into the bundle would look like the gate without
 * being it, and would then need keeping in step with the copy in
 * `database.rules.json` that actually decides. There is one copy, and it is the
 * one Firebase enforces.
 *
 * Reject is a **delete**, and it is the only write in the app that removes
 * anything. It exists because a declined Suggestion otherwise has nowhere to be
 * recorded and would sit in the queue for ever; accepting one is still a commit,
 * which no browser can make.
 */
export default function useAdmin(): Admin {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [suggestions, setSuggestions] = useState<StoredSuggestion[] | null>(
    null,
  );
  const [denied, setDenied] = useState(false);

  useEffect(
    () =>
      watchNamedUser((next) => {
        setUser(next && { uid: next.uid, email: next.email });
        // A different account is a different answer to the same question.
        setSuggestions(null);
        setDenied(false);
      }),
    [],
  );

  useEffect(() => {
    if (user === null) return;

    const unsubscribe = onValue(
      ref(db, "suggestions"),
      (snapshot) => {
        const entries: StoredSuggestion[] = [];
        snapshot.forEach((child) => {
          const value = child.val() ?? {};
          entries.push({ key: child.key ?? "", ...value });
        });
        // Oldest first: a review queue is worked from the front.
        entries.sort((a, b) => a.createdAt - b.createdAt);
        setSuggestions(entries);
        setDenied(false);
      },
      () => {
        // The only error this read has is PERMISSION_DENIED, and it is not a
        // failure — it is the rules answering the question the screen asked.
        setSuggestions(null);
        setDenied(true);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await signOutNamed();
  }, []);

  const reject = useCallback(async (key: string) => {
    await remove(ref(db, `suggestions/${key}`));
  }, []);

  let access: AdminAccess;
  if (user === null) {
    access = { state: "signed-out" };
  } else if (denied) {
    access = { state: "denied", user };
  } else if (suggestions === null) {
    access = { state: "checking", user };
  } else {
    access = { state: "allowed", user, suggestions };
  }

  return { access, signIn, signOut, reject };
}
