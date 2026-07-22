# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` (alias `npm run dev`) — Run the Vite dev server (localhost:5173, served under the `/geotracks/` base)
- `npm test` — Run the unit-test suite once under Vitest; `npm run test:watch` for interactive watch mode
- `npm run build` — Type-check (`tsc`) then produce a production bundle in `dist/`
- `npm run preview` — Serve the production `dist/` build locally
- `npm run deploy` — Build and deploy `dist/` to GitHub Pages via gh-pages
- `npm run cy:open` / `npm run cy:run` — Cypress e2e runner (open / headless)

### Configuration / env

Client config is read from Vite env vars (`import.meta.env.VITE_*`). Copy `.env.example` → `.env` (gitignored) and set `VITE_FIREBASE_DB_URL` (the Firebase RTDB base URL backing the leaderboard). Values are surfaced through `src/config.ts`.

> **Production-readiness effort in flight:** a Wayfinder map ([GitHub issue #4](https://github.com/georgeharvey3/geotracks/issues/4)) tracks pending decisions to harden this repo. The **CRA → Vite** and **Jest → Vitest** migrations have landed (issue #12); still pending are retiring Cypress for RTL/Vitest integration tests, locking down the Firebase leaderboard, a full `App.tsx` refactor, and GitHub Actions CI/CD.

## Architecture

GeoTracks is a **React 18 + TypeScript** music geography guessing game (built with Vite, MUI for components/theming). Players listen to Spotify clips and guess the country of origin. Two game modes: **Infinite** (unlimited rounds) and **Competition** (10 turns with scoring and a Firebase-backed leaderboard).

### State Management

All game state lives in `src/App.tsx` (~600 lines) via useState/useEffect/useRef hooks — there is no state management library. Components under `src/Components/` are purely presentational and receive everything through props.

### Spotify Integration

Playback uses the **Spotify IFrame API**: a controller is created against a hidden embed element (`IFrameAPI.createController`) and driven programmatically (`controller.togglePlay()`, `controller.loadUri()`). Clips auto-pause after ~30 seconds. Track title, artist, and thumbnail are fetched separately from the **Spotify oEmbed API** (`https://open.spotify.com/oembed?url=...`). The app listens for `message` events from `https://open.spotify.com` to track ready/playing/paused/finished states, and has automatic retries plus a manual retry fallback when a track fails to load.

### Scoring & Firebase

- Scores are stored in Firebase Realtime Database via a raw `fetch` to `geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json` (no SDK/auth yet — hardening is tracked in issue #4)
- Score values by guess attempt: 1st=150, 2nd=80, 3rd=60, 4th=40, 5th=20
- Enabling geo hints halves the score for that round
- Each calendar day starts with the same seeded song set (`src/helpers/getDailySongs.ts`, Mulberry32 PRNG) so scores are comparable; once exhausted, songs are random. Albums are removed from the pool after selection to prevent repeats within a session.

### Geo Hints System

When enabled, incorrect guesses show distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) to the correct country. Uses the Haversine formula (`src/helpers/getDistance.ts`) and bearing calculation (`src/helpers/getBearing.ts`) with coordinates from `src/countries.json`.

### Key Data Files

- `src/albums.json` — Array of `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Array of `{ code, name, lat, lon }` used for autocomplete and distance/bearing calculations
- `src/types.ts` — Shared TypeScript types
- `src/theme.ts` — MUI theme

### Keyboard Shortcuts (registered in `src/App.tsx`)

- Space: toggle playback
- Enter: next song (when round finished)
- Typing auto-focuses the country input; Escape blurs it

### CountryInput Component

Custom autocomplete (`src/Components/CountryInput/`) built with React state — no external autocomplete library. Supports arrow-key navigation, Enter to select, and Escape/click-outside to close.
