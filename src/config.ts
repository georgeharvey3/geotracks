// Runtime configuration sourced from Vite env vars (`import.meta.env.VITE_*`).
// See `.env.example` for the variables this app expects.

const FALLBACK_FIREBASE_DB_URL =
  "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app";

// Base URL of the Firebase Realtime Database backing the leaderboard. Falls
// back to the public database when unset or empty so the app still boots
// without a local `.env`. This URL is not a secret — it already ships in the
// client bundle; access is locked down by the RTDB security rules
// (`database.rules.json`) plus anonymous auth, not by hiding the URL.
export const FIREBASE_DB_URL =
  import.meta.env.VITE_FIREBASE_DB_URL || FALLBACK_FIREBASE_DB_URL;

// Firebase project config for the JS SDK. Every value is a public client
// identifier (Firebase web config is designed to ship in the bundle); data is
// protected by security rules, not by these values being secret.
//
// Reading the leaderboard needs only `databaseURL` (which has a fallback), so
// the public score list renders even with the rest unset. Submitting a score
// signs in anonymously first, which requires a valid `apiKey` plus the
// Anonymous provider enabled in the Firebase console — set these for writes to
// work.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
