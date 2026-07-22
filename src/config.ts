// Runtime configuration sourced from Vite env vars (`import.meta.env.VITE_*`).
// See `.env.example` for the variables this app expects.

const FALLBACK_FIREBASE_DB_URL =
  "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app";

// Base URL of the Firebase Realtime Database. The `scores.json` REST endpoint
// is derived from this. Falls back to the public database when unset or empty
// so the app still boots without a local `.env`. This URL is not a secret — it
// already ships in the client bundle; locking down access is tracked in #4.
export const FIREBASE_DB_URL =
  import.meta.env.VITE_FIREBASE_DB_URL || FALLBACK_FIREBASE_DB_URL;

export const SCORES_URL = `${FIREBASE_DB_URL}/scores.json`;
