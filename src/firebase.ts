// Firebase app singleton + Realtime Database / anonymous-auth handles.
//
// The web config is public by design (see `src/config.ts`); the leaderboard is
// protected by the committed RTDB security rules (`database.rules.json`), which
// require an authenticated (anonymous) user to append records. All access goes
// through the Firebase JS SDK — there are no raw REST fetches in the app.
import { FirebaseApp, initializeApp } from "firebase/app";
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { firebaseConfig } from "./config";

const app = initializeApp(firebaseConfig);

// `getDatabase` only needs `databaseURL` (which has a committed fallback in
// `config.ts`), so the database handle — and therefore public leaderboard
// reads — always works, even without an API key.
export const db = getDatabase(app);

// Auth is resolved lazily. `getAuth(app)` throws synchronously when `apiKey` is
// missing/invalid (`auth/invalid-api-key`); calling it eagerly at module load
// would take down the entire app — including the game and the read-only
// leaderboard — for a credential only *score submission* needs. Constructing it
// on first write keeps the app booting (and reads working) without a key, and
// surfaces the error only to the submit path, where it can be handled.
let auth: Auth | null = null;

function getAuthOrThrow(existing: FirebaseApp): Auth {
  if (!auth) {
    auth = getAuth(existing);
  }
  return auth;
}

// Cache the in-flight/completed anonymous sign-in so concurrent callers (reads
// and writes) share a single credential instead of racing separate sign-ins.
let anonAuthPromise: Promise<string> | null = null;

// Resolve with the anonymous user's uid once one exists. RTDB rules gate every
// write on `auth != null`, so callers must await this before writing; the uid
// itself is what a Suggestion stores, since a public-write node with no
// attributable identity is one that can only be defended by deleting all of it.
// Rejects with `auth/invalid-api-key` when no valid API key is configured.
export function ensureAnonymousAuth(): Promise<string> {
  let authInstance: Auth;
  try {
    authInstance = getAuthOrThrow(app);
  } catch (error) {
    // Missing/invalid API key: reject rather than throw synchronously so every
    // caller sees a consistent rejected promise.
    return Promise.reject(error);
  }

  if (authInstance.currentUser) {
    return Promise.resolve(authInstance.currentUser.uid);
  }
  if (!anonAuthPromise) {
    anonAuthPromise = signInAnonymously(authInstance)
      .then((credential) => credential.user.uid)
      .catch((error) => {
        // Allow a later call to retry if this sign-in failed.
        anonAuthPromise = null;
        throw error;
      });
  }
  return anonAuthPromise;
}

// --------------------------------------------------------- named sign-in
//
// The app has exactly one thing a *named* identity is for: reading the
// Suggestions, which no player may do. It is deliberately not a login — nothing
// about playing changes, no account is offered anywhere, and the only screen
// that asks for one is reached by a URL nobody is given.
//
// **There is no secret here, and that is the point.** A static site cannot hold
// one: anything the bundle can compare against, every visitor has already
// downloaded. So the gate is not in the client at all — `database.rules.json`
// names the uid allowed to read `suggestions`, Firebase enforces it, and this
// file only carries the sign-in that produces a uid to be judged. The admin
// screen ships to everyone and is empty for everyone else.

/**
 * Sign in with Google, replacing whatever anonymous user was in play.
 *
 * `ensureAnonymousAuth` hands back `currentUser` when there is one, so a score
 * or Suggestion written afterwards carries this uid instead of an anonymous
 * one — which the rules accept either way, since they ask only for `auth !=
 * null`.
 */
export function signInWithGoogle(): Promise<User> {
  let authInstance: Auth;
  try {
    authInstance = getAuthOrThrow(app);
  } catch (error) {
    return Promise.reject(error);
  }
  return signInWithPopup(authInstance, new GoogleAuthProvider()).then(
    (credential) => credential.user,
  );
}

/**
 * Sign out. The next write goes back to signing in anonymously, so the cached
 * promise has to go with it or it would hand back a uid that no longer exists.
 */
export function signOutNamed(): Promise<void> {
  let authInstance: Auth;
  try {
    authInstance = getAuthOrThrow(app);
  } catch (error) {
    return Promise.reject(error);
  }
  anonAuthPromise = null;
  return signOut(authInstance);
}

/**
 * Watch who is signed in, reporting `null` for nobody **and for an anonymous
 * user** — anonymous is how every player is signed in, so to the one screen
 * that cares it is indistinguishable from signed out.
 *
 * Returns a no-op unsubscribe when auth cannot be constructed at all (no API
 * key), so a missing credential leaves the screen saying "signed out" rather
 * than taking the app down.
 */
export function watchNamedUser(
  onUser: (user: User | null) => void,
): () => void {
  let authInstance: Auth;
  try {
    authInstance = getAuthOrThrow(app);
  } catch {
    onUser(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, (user) =>
    onUser(user && !user.isAnonymous ? user : null),
  );
}
