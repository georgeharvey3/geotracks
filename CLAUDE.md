# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` (alias `npm run dev`) — Run the Vite dev server (localhost:5173, served under the `/geotracks/` base)
- `npm test` — Run the unit-test suite once under Vitest; `npm run test:watch` for interactive watch mode
- `npm run build` — Type-check (`tsc`) then produce a production bundle in `dist/`
- `npm run preview` — Serve the production `dist/` build locally
- `npm run lint` — ESLint over the repo; `npm run format` / `npm run format:check` for Prettier
- `npm run test:coverage` — Run the suite with a V8 coverage report (`coverage/`); reported only, no enforced gate

### CI/CD & deployment

Deployment is fully automated via GitHub Actions (`.github/workflows/ci.yml`) — there is no local `deploy` script. Every push and PR runs a `quality` job (lint + `tsc --noEmit` + `vitest run` + `vite build`) on the Node version pinned in `.nvmrc`. On push to `main`, a `deploy` job (gated `needs: quality`) publishes `dist/` to GitHub Pages via `actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`. The repo's Pages **Source** must be set to **"GitHub Actions"** (Settings → Pages), and `main` is branch-protected to require a PR and a passing `quality` check.

### Configuration / env

Client config is read from Vite env vars (`import.meta.env.VITE_*`). Copy `.env.example` → `.env` (gitignored) and set the `VITE_FIREBASE_*` values (RTDB base URL plus the Firebase web config for the SDK). Values are surfaced through `src/config.ts` and the SDK is initialised in `src/firebase.ts`. These are public client identifiers, not secrets.

> **Production-readiness backlog complete:** the hardening effort tracked in [GitHub issue #4](https://github.com/georgeharvey3/geotracks/issues/4) has landed in full — **CRA → Vite** and **Jest → Vitest** migrations (issue #12), Firebase leaderboard hardening (issue #17: SDK + anonymous auth + append-only rules), retirement of Cypress in favour of RTL/Vitest integration tests (issue #18), GitHub Actions CI/CD with PR-gated branch protection and automated Pages deploy (issue #19), the `App.tsx` refactor into reducer/context/hooks, and the docs/code-health cleanup (issue #20).

## Architecture

GeoTracks is a **React 18 + TypeScript** music geography guessing game (built with Vite, MUI for components/theming). Players listen to Spotify clips and guess the country of origin. Two game modes: **Infinite** (unlimited rounds) and **Competition** (10 turns with scoring and a Firebase-backed leaderboard).

### State Management

Game state lives in a pure reducer (`src/state/gameReducer.ts`) exposed through React context (`src/context/GameContext.tsx`) — there is no state management library. `GameProvider` owns the single `useReducer` instance (plus the leaderboard hook) and components consume it via the `useGame()` / `useLeaderboard()` context hooks. `src/App.tsx` is now just a thin screen router that switches on `state.screen` (`menu` | `playing` | `scoreboard` | `finalScore`). Side effects are isolated in hooks under `src/hooks/`:

- `useSpotifyPlayer` — the entire imperative Spotify IFrame integration (controller lifecycle, oEmbed metadata, retries)
- `useKeyboardShortcuts` — document-level key handlers for the game screen
- `useLeaderboard` — all Firebase leaderboard reads/writes

`src/Components/GameScreen/GameScreen.tsx` is the container that wires the player and keyboard hooks to the reducer; everything below it (under `src/Components/`) stays purely presentational and receives everything through props.

### Spotify Integration

Playback uses the **Spotify IFrame API**, wrapped entirely by `src/hooks/useSpotifyPlayer.ts`: a controller is created against a hidden embed element (`IFrameAPI.createController`) and driven programmatically (`controller.togglePlay()`, `controller.loadUri()`). Clips auto-pause after ~30 seconds. Track title, artist, and thumbnail are fetched separately from the **Spotify oEmbed API** (`https://open.spotify.com/oembed?url=...`). Ready/playing/paused/finished states come from the controller's `ready` and `playback_update` listeners, and the hook has automatic retries plus a manual retry fallback when a track fails to load.

### Scoring & Firebase

- Scores are stored in Firebase Realtime Database via the **Firebase JS SDK** with **anonymous auth**, all behind the `useLeaderboard` hook (`src/hooks/useLeaderboard.ts`); the SDK is initialised in `src/firebase.ts`. Records are append-only (`scores/{pushId}: { name, score, createdAt }`, written with `push()`); reads are bounded (`orderByChild("score").limitToLast(20)`). Access is locked down by committed security rules (`database.rules.json` + `firebase.json`): public read, per-record create-only write (`auth != null && !data.exists()`), and strict `.validate` (name 1–10 chars, integer score 0–1500, `createdAt == now`, no extra fields). Deploy with `firebase deploy --only database`; migrate legacy `{name:score}` data first via `node scripts/migrate-scores.mjs --apply`.
- Score values by guess attempt: 1st=150, 2nd=80, 3rd=60, 4th=40, 5th=20
- Enabling geo hints halves the score for that round
- Canonical competition score range is **0–1500** (`MAX_COMPETITION_SCORE` in `src/state/gameReducer.ts` = `SCORE_VALUES[1] * NUM_COMPETITION_TURNS`, i.e. 10 first-guess correct answers with no hints). This is the bound the leaderboard `.validate` rule enforces (issue #7).
- Each calendar day starts with the same seeded song set (`src/helpers/getDailySongs.ts`, Mulberry32 PRNG) so scores are comparable; once exhausted, songs are random. Albums are removed from the pool after selection to prevent repeats within a session.

### Geo Hints System

When enabled, incorrect guesses show distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) to the correct country. Uses the Haversine formula (`src/helpers/getDistance.ts`) and bearing calculation (`src/helpers/getBearing.ts`) with coordinates from `src/countries.json`.

### Key Files

- `src/state/gameReducer.ts` — Pure game reducer, plus scoring/mode constants (`SCORE_VALUES`, `NUM_COMPETITION_TURNS`, `MAX_COMPETITION_SCORE`, `GAME_MODES`)
- `src/context/GameContext.tsx` — `GameProvider` + `useGame()` / `useLeaderboard()` context hooks
- `src/hooks/` — Side-effect seams: `useSpotifyPlayer`, `useKeyboardShortcuts`, `useLeaderboard`
- `src/albums.json` — Array of `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Array of `{ code, name, lat, lon }` used for autocomplete and distance/bearing calculations
- `src/types.ts` — Shared TypeScript types
- `src/theme.ts` — MUI theme

### Testing

Vitest + React Testing Library only — Cypress is retired. `src/App.test.tsx` holds the integration suite: it mounts the real `<App>` (real reducer, context, routing, keyboard shortcuts) and `vi.mock`s only the two side-effectful seams, using the controllable fakes in `src/test/` (`spotifyPlayerFake.ts`, `leaderboardFake.ts`). Unit tests sit next to their subjects (`*.test.ts(x)`). `src/test-utils.tsx` re-exports RTL with a theme-wrapped `render`. TypeScript is strict (including `noUncheckedIndexedAccess` and unused-code checks — see `tsconfig.json`).

### Keyboard Shortcuts (`src/hooks/useKeyboardShortcuts.ts`, wired in `GameScreen`)

- Space: toggle playback
- Enter: next song (when round finished)
- Typing auto-focuses the country input; Escape blurs it

### CountryInput Component

Custom autocomplete (`src/Components/CountryInput/`) built with React state — no external autocomplete library. Supports arrow-key navigation, Enter to select, and Escape/click-outside to close.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to identically-named labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
