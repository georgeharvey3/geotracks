import { useCallback } from "react";
import { push, ref, serverTimestamp } from "firebase/database";

import { db, ensureAnonymousAuth } from "../firebase";

/** What a player proposes, as the form has it. */
export interface NewSuggestion {
  /** 22 base62 characters, already extracted by `extractAlbumId`. */
  albumId: string;
  /** ISO alpha-2. A stored record outlives any display string we might rename. */
  countryCode: string;
  /** Why, optionally. Already trimmed and already absent when the box was blank. */
  note?: string;
}

export interface Suggestions {
  /**
   * Append one Suggestion. Resolves when the write lands and rejects if it
   * doesn't, so the form can say so and leave the typed values intact.
   */
  submitSuggestion: (suggestion: NewSuggestion) => Promise<void>;
}

/**
 * The Suggestion write, behind a stable surface — the leaderboard's seam with
 * one half missing.
 *
 * **The client writes and never reads.** `suggestions` gets no `.read` in
 * `database.rules.json` and so inherits `false` from the root: the only reader
 * is the Firebase console, which bypasses rules. Suggestions are reviewed by a
 * human there and accepted by a commit — the app collects them and does not act
 * on them.
 */
export default function useSuggestions(): Suggestions {
  const submitSuggestion = useCallback(async (suggestion: NewSuggestion) => {
    // Anonymous auth already mints a uid for the write to happen at all, so the
    // record keeps it: it is the only thing distinguishing one contributor from
    // a script.
    const uid = await ensureAnonymousAuth();

    await push(ref(db, "suggestions"), {
      albumId: suggestion.albumId,
      countryCode: suggestion.countryCode,
      // Belt to the form's brace, and the reason this is the boundary that
      // decides: the SDK throws on an `undefined` value, so the field has to be
      // either present and non-empty or absent from the object entirely.
      ...(suggestion.note ? { note: suggestion.note } : {}),
      uid,
      createdAt: serverTimestamp(),
    });
  }, []);

  return { submitSuggestion };
}
