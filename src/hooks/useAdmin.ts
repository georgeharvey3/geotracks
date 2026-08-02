import { useCallback, useEffect, useState } from "react";
import { get, onValue, push, ref, remove, update } from "firebase/database";

import {
  db,
  signInWithGoogle,
  signOutNamed,
  watchNamedUser,
} from "../firebase";
import { countryNameByCode } from "../map/geography";
import { bundledAlbums } from "../music/library";
import { communityAlbumFrom, heldTrack } from "../music/acceptance";
import { fetchAlbum } from "../spotify/catalogue";
import { CommunityAlbum } from "../types";

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

/** What accepting needs that the Suggestion itself cannot say. */
export interface AcceptOptions {
  /** The reviewer's Spotify access token — see `useSpotifyAuth`. */
  token: string;
  /**
   * The album's switch-on date for Competition, `YYYY-MM-DD`.
   *
   * Passed in rather than read from the clock here, following
   * `helpers/dailyRun.ts`: a hook that read `new Date()` could only be tested by
   * moving the system clock, which moves the daily seed with it.
   */
  liveFrom: string;
}

export type AcceptOutcome =
  | { ok: true; album: CommunityAlbum }
  /** The Spotify token has run out or was refused: connect again. */
  | { ok: false; reason: "unauthorized" }
  /** Spotify has no such album, or it has no tracks to play. */
  | { ok: false; reason: "missing" }
  /** Spotify could not be reached. Retryable as it stands. */
  | { ok: false; reason: "spotify" }
  /** Already in the Library, matched on a track. Names the album holding it. */
  | { ok: false; reason: "duplicate"; albumName: string }
  /** The Suggestion names a code `countries.json` does not have. */
  | { ok: false; reason: "country" }
  /** The database refused the write, or could not be reached. */
  | { ok: false; reason: "write" };

/**
 * What a refused sign-in was refused for.
 *
 * `code` is Firebase's own (`auth/unauthorized-domain`,
 * `auth/popup-blocked`, …), passed through untranslated on purpose: this is the
 * screen where the setup is still wrong, and the exact string is what a search
 * or a console page is found by. `cancelled` marks the reviewer closing the
 * popup themselves, which is not a failure and must not be reported as one.
 */
export interface SignInFailure {
  code: string;
  cancelled: boolean;
}

export type SignInOutcome = { ok: true } | ({ ok: false } & SignInFailure);

/** Firebase errors carry a `code`; nothing else here is guaranteed to. */
function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code ? code : "unknown";
}

export interface Admin {
  access: AdminAccess;
  /**
   * Sign in with Google. Reports rather than throws, as `accept` does: the
   * failure that actually happens here is a misconfiguration
   * (`auth/unauthorized-domain` — the origin is not on Firebase's authorized
   * domains list), and it is unrecognisable without its code.
   */
  signIn: () => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
  /** Delete one Suggestion. Resolves when it is gone, rejects if it is not. */
  reject: (key: string) => Promise<void>;
  /**
   * Accept one Suggestion: write the album, delete the Suggestion, in one
   * atomic update. Reports what happened rather than throwing — every way this
   * fails is something the reviewer is told and can act on.
   */
  accept: (
    suggestion: StoredSuggestion,
    options: AcceptOptions,
  ) => Promise<AcceptOutcome>;
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
 * recorded and would sit in the queue for ever.
 *
 * **Accept is the whole of accepting** (ADR-0008), which used to be a command to
 * copy: the album's tracks are read from Spotify's catalogue with the reviewer's
 * own token, checked against the Library, and written as one atomic update that
 * also deletes the Suggestion. Two services in one seam is deliberate — a
 * half-accept, an album written with the Suggestion left queued or the reverse,
 * is the failure worth designing out, and it can only be designed out by one
 * thing owning both halves. It is also why the screen needs exactly one fake to
 * test.
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

  const signIn = useCallback(async (): Promise<SignInOutcome> => {
    try {
      await signInWithGoogle();
      return { ok: true };
    } catch (error) {
      const code = errorCode(error);
      return {
        ok: false,
        code,
        // Closing the popup, or opening a second one, is the reviewer's own
        // doing and says nothing about the setup.
        cancelled:
          code === "auth/popup-closed-by-user" ||
          code === "auth/cancelled-popup-request",
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutNamed();
  }, []);

  const reject = useCallback(async (key: string) => {
    await remove(ref(db, `suggestions/${key}`));
  }, []);

  const accept = useCallback(
    async (
      suggestion: StoredSuggestion,
      options: AcceptOptions,
    ): Promise<AcceptOutcome> => {
      // The Library joins by country **name**; a Suggestion stores the alpha-2
      // code, because "is this string one of 246 names?" is not something an
      // RTDB rule can ask. A code with no country is unacceptable rather than
      // wrong — there is nothing to write against it.
      const country = countryNameByCode(suggestion.countryCode);
      if (!country) return { ok: false, reason: "country" };

      const fetched = await fetchAlbum(suggestion.albumId, options.token);
      if (!fetched.ok) {
        return fetched.reason === "failed"
          ? { ok: false, reason: "spotify" }
          : { ok: false, reason: fetched.reason };
      }

      // The live half of the Library, read fresh rather than taken from the copy
      // the app booted with: this is the one moment where being a minute out of
      // date means writing the same album twice.
      let live: CommunityAlbum[];
      try {
        const snapshot = await get(ref(db, "communityAlbums"));
        live = Object.values(
          (snapshot.val() as Record<string, CommunityAlbum> | null) ?? {},
        );
      } catch {
        return { ok: false, reason: "write" };
      }

      const duplicate = heldTrack(fetched.album.tracks, [
        ...bundledAlbums,
        ...live,
      ]);
      if (duplicate) {
        return {
          ok: false,
          reason: "duplicate",
          albumName: duplicate.albumName,
        };
      }

      const album = communityAlbumFrom({
        country,
        albumName: fetched.album.name,
        tracks: fetched.album.tracks,
        liveFrom: options.liveFrom,
        suggestion: suggestion.key,
      });

      // `push` with nothing to write generates a key without touching the
      // database, which is what a multi-path update needs: it has to name both
      // paths at once, so it cannot let `push()` invent one on the way. Push keys
      // are chronological and sort as plain strings, and that order is part of
      // the contract — the daily seed draws by index into the Library.
      const key = push(ref(db, "communityAlbums")).key;
      if (!key) return { ok: false, reason: "write" };

      try {
        // One update from the root, which RTDB applies atomically: there is no
        // window in which the album exists and the Suggestion is still queued,
        // or the reverse. The queue empties itself and there is no "reviewed"
        // flag to keep in step.
        await update(ref(db), {
          [`communityAlbums/${key}`]: album,
          [`suggestions/${suggestion.key}`]: null,
        });
      } catch {
        return { ok: false, reason: "write" };
      }

      return { ok: true, album };
    },
    [],
  );

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

  return { access, signIn, signOut, reject, accept };
}
