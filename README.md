# GeoTracks

GeoTracks is a music geography guessing game. Players listen to a short Spotify clip and guess the country the track comes from. Wrong guesses can reveal how far away — and in which direction — the correct country lies.

🎮 **Play it:** https://georgeharvey3.github.io/geotracks

## Game Modes

- **Competition** — 10 turns with scoring and a global Firebase-backed leaderboard. Submit your name at the end to save your score.
- **Infinite** — Unlimited rounds for casual play, no scoring.
- **Scoreboard** — View the top 10 competition scores.

Each day everyone starts with the same seeded set of songs (deterministic per calendar date), so scores are comparable. Once the daily set is exhausted, songs are chosen at random.

## How Scoring Works

Points are awarded by how few guesses you needed:

| Guess attempt | 1st | 2nd | 3rd | 4th | 5th |
| ------------- | --- | --- | --- | --- | --- |
| Points        | 150 | 80  | 60  | 40  | 20  |

You get up to 5 guesses per round. Enabling **geo hints** for a round halves the points earned that round. A perfect competition run (10 first-guess correct answers, no hints) scores the maximum of **1500**.

## Geo Hints

When enabled, each incorrect guess shows the distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) from your guess toward the correct country. Distances use the Haversine formula (`src/helpers/getDistance.ts`) and bearings use a standard great-circle bearing calculation (`src/helpers/getBearing.ts`), both driven by coordinates in `src/countries.json`.

## Keyboard Shortcuts

- **Space** — Toggle playback
- **Enter** — Next song (once the round is finished)
- **Typing** — Auto-focuses the country input
- **Escape** — Blurs the country input

## Tech Stack

- **React 18** + **TypeScript**, built with **Vite**
- **MUI (Material UI)** for components and theming
- **Firebase Realtime Database** for the competition leaderboard
- **Spotify IFrame API** for playback, **Spotify oEmbed API** for track metadata
- **Vitest** + **React Testing Library** for unit tests, **Cypress** for end-to-end tests

## Architecture

All game state lives in `src/App.tsx` via React hooks — there is no state management library. Components under `src/Components/` are presentational and receive everything through props.

### Spotify Integration

Playback uses the Spotify IFrame API: a controller is created against a hidden embed element and driven programmatically (`togglePlay`, `loadUri`). Clips play for 30 seconds before auto-pausing. Track title, artist, and thumbnail are fetched separately from the Spotify oEmbed API. Loading has automatic retries and a manual retry fallback if a track fails to load.

### Firebase

Scores live in Firebase Realtime Database, accessed through the **Firebase JS SDK** with **anonymous auth** — never raw REST fetches. All leaderboard I/O sits behind the `useLeaderboard` hook (`src/hooks/useLeaderboard.ts`); the SDK is initialised once in `src/firebase.ts` from the public web config in `src/config.ts` (sourced from `VITE_FIREBASE_*` env vars — see `.env.example`).

Scores are an **append-only** list: `scores/{pushId}: { name, score, createdAt }`. Writes use `push()`; reads are ordered and bounded server-side (`orderByChild("score").limitToLast(20)`). The Firebase web config values are public client identifiers by design — the leaderboard is protected by security rules, not by hiding them.

#### Security rules

`database.rules.json` (wired up by `firebase.json`) enforces:

- **Public read**, with `.indexOn: ["score"]` so ordered reads are efficient.
- **Append-only writes**: a record may only be created (`auth != null && !data.exists() && newData.exists()`) — existing records can't be overwritten or deleted.
- **Strict validation**: exactly `{ name, score, createdAt }`, `name` a 1–10 char string, `score` an integer in `0…1500` (the maximum competition score), and `createdAt == now`.

Deploy the rules with:

```bash
firebase deploy --only database
```

Before the strict rules go live, migrate any existing legacy `{name: score}` data into push records (backfilling `createdAt`) — run **while the database is still open**:

```bash
node scripts/migrate-scores.mjs          # dry run — prints the plan
node scripts/migrate-scores.mjs --apply  # perform the migration
```

For the client to sign in, add **Anonymous** as a sign-in provider in the Firebase console (Authentication → Sign-in method), and add the app's origins under Authentication → Settings → Authorized domains: `georgeharvey3.github.io` and `localhost`.

### Key Files

- `src/App.tsx` — All game state and logic
- `src/albums.json` — Song pool: `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Country list with coordinates for autocomplete and distance/bearing math
- `src/types.ts` — Shared TypeScript types
- `src/theme.ts` — MUI theme
- `src/helpers/getDailySongs.ts` — Seeded daily song selection (Mulberry32 PRNG)
- `src/Components/CountryInput/` — Custom autocomplete input (arrow-key navigation, no external library)

## Development

- `npm start` — Run the Vite dev server at [localhost:5173/geotracks/](http://localhost:5173/geotracks/)
- `npm test` — Run the unit-test suite once under Vitest (`npm run test:watch` for watch mode)
- `npm run build` — Type-check and produce a production build in `dist/`
- `npm run preview` — Serve the production build locally
- `npm run cy:open` — Open the Cypress test runner
- `npm run cy:run` — Run Cypress tests headlessly
- `npm run deploy` — Build and deploy `dist/` to GitHub Pages via gh-pages
