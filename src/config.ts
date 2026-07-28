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
// protected by the RTDB security rules (`database.rules.json`) plus anonymous
// auth, NOT by these values being secret. They are therefore committed as
// fallbacks — same as `databaseURL` above — so the app (and the leaderboard,
// including anonymous-auth score writes) works out of the box, both in local
// dev without a `.env` and in CI/production without injected env vars. An
// `import.meta.env.VITE_FIREBASE_*` override still wins when set, e.g. to point
// a fork at a different Firebase project.
//
// Score submission additionally requires the Anonymous sign-in provider to be
// enabled in the Firebase console (Authentication → Sign-in method).
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyC6o9I68tn0KiDNaceuQF1UjKpo4YJRoV8",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "geotracks-d9b5c.firebaseapp.com",
  databaseURL: FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "geotracks-d9b5c",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "geotracks-d9b5c.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "309832762507",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:309832762507:web:00232dc3ff78ae898ac08e",
};
