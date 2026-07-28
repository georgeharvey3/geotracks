// Firebase app singleton + Realtime Database / anonymous-auth handles.
//
// The web config is public by design (see `src/config.ts`); the leaderboard is
// protected by the committed RTDB security rules (`database.rules.json`), which
// require an authenticated (anonymous) user to append records. All access goes
// through the Firebase JS SDK — there are no raw REST fetches in the app.
import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth, signInAnonymously } from "firebase/auth";
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
let anonAuthPromise: Promise<unknown> | null = null;

// Resolve once an anonymous user exists. RTDB rules gate every write on
// `auth != null`, so callers must await this before submitting a score. Rejects
// with `auth/invalid-api-key` when no valid API key is configured.
export function ensureAnonymousAuth(): Promise<unknown> {
  let authInstance: Auth;
  try {
    authInstance = getAuthOrThrow(app);
  } catch (error) {
    // Missing/invalid API key: reject rather than throw synchronously so every
    // caller sees a consistent rejected promise.
    return Promise.reject(error);
  }

  if (authInstance.currentUser) {
    return Promise.resolve(authInstance.currentUser);
  }
  if (!anonAuthPromise) {
    anonAuthPromise = signInAnonymously(authInstance).catch((error) => {
      // Allow a later call to retry if this sign-in failed.
      anonAuthPromise = null;
      throw error;
    });
  }
  return anonAuthPromise;
}
