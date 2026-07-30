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
- **Vitest** + **React Testing Library** for unit and integration tests

## Architecture

Game state lives in a pure reducer (`src/state/gameReducer.ts`) exposed through React context (`src/context/GameContext.tsx`) — there is no state management library. `src/App.tsx` is a thin screen router, side effects are isolated in hooks under `src/hooks/` (`useSpotifyPlayer`, `useKeyboardShortcuts`, `useLeaderboard`), and components under `src/Components/` are presentational and receive everything through props. `GameScreen` is the container that wires the hooks to the reducer.

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

- `src/state/gameReducer.ts` — Pure game reducer and scoring constants
- `src/context/GameContext.tsx` — `GameProvider` plus the `useGame()` / `useLeaderboard()` hooks
- `src/hooks/` — Side-effect seams: Spotify player, keyboard shortcuts, leaderboard
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
- `npm run lint` — Lint the repo with ESLint (`npm run format` / `npm run format:check` for Prettier)
- `npm run test:coverage` — Run the suite with a V8 coverage report

Tests are Vitest + React Testing Library throughout: unit tests live next to their subjects, and `src/App.test.tsx` is an integration suite that mounts the real app with only the Spotify player and leaderboard seams faked (`src/test/`).

## Branching

Two long-lived branches, and the difference between them is what is live:

- **`develop`** — the default branch, and where all work lands. Branch off it, open a PR back into it, **squash-merge**. Its history stays linear.
- **`main`** — what is deployed. It only ever receives `develop`.

**A release is a PR from `develop` into `main`, merged with a merge commit** (not squashed — squashing would flatten the release into one commit and permanently diverge the two histories). Merging it is what ships the site, so open one when `develop` is in a state worth publishing.

Both branches require a PR and a passing `quality` check, and neither accepts force-pushes or deletion. `develop` additionally requires branches to be up to date before merging, because feature branches land there concurrently; `main` does not, since `develop` is its only source.

## Deployment

Deployment is automated by GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — there is no local deploy step. Every push and pull request runs a `quality` job (lint, type-check, tests, build) on the Node version pinned in [`.nvmrc`](.nvmrc). Merges to `main` — i.e. releases — trigger a gated `deploy` job that publishes `dist/` to GitHub Pages. Pushes to `develop` run `quality` but deploy nothing. The repo's Pages **Source** is set to **"GitHub Actions"**.
