// Firebase app singleton + Realtime Database / anonymous-auth handles.
//
// The web config is public by design (see `src/config.ts`); the leaderboard is
// protected by the committed RTDB security rules (`database.rules.json`), which
// require an authenticated (anonymous) user to append records. All access goes
// through the Firebase JS SDK — there are no raw REST fetches in the app.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { firebaseConfig } from "./config";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

// Cache the in-flight/completed anonymous sign-in so concurrent callers (reads
// and writes) share a single credential instead of racing separate sign-ins.
let anonAuthPromise: Promise<unknown> | null = null;

// Resolve once an anonymous user exists. RTDB rules gate every write on
// `auth != null`, so callers must await this before reading or writing scores.
export function ensureAnonymousAuth(): Promise<unknown> {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  if (!anonAuthPromise) {
    anonAuthPromise = signInAnonymously(auth).catch((error) => {
      // Allow a later call to retry if this sign-in failed.
      anonAuthPromise = null;
      throw error;
    });
  }
  return anonAuthPromise;
}
