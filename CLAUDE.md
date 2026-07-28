# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` (alias `npm run dev`) — Run the Vite dev server (localhost:5173, served under the `/geotracks/` base)
- `npm test` — Run the unit-test suite once under Vitest; `npm run test:watch` for interactive watch mode
- `npm run build` — Type-check (`tsc`) then produce a production bundle in `dist/`
- `npm run preview` — Serve the production `dist/` build locally
- `npm run lint` — ESLint over the repo; `npm run format` / `npm run format:check` for Prettier
- `npm run test:coverage` — Run the suite with a V8 coverage report (`coverage/`); reported only, no enforced gate
- `node scripts/build-map-geometry.mjs` — Regenerate the map's bundled country geometry (only needed after changing `src/countries.json` or the straggler threshold; see ADR-0002)

### CI/CD & deployment

Deployment is fully automated via GitHub Actions (`.github/workflows/ci.yml`) — there is no local `deploy` script. Every push and PR runs a `quality` job (lint + `tsc --noEmit` + `vitest run` + `vite build`) on the Node version pinned in `.nvmrc`. On push to `main`, a `deploy` job (gated `needs: quality`) publishes `dist/` to GitHub Pages via `actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`. The repo's Pages **Source** must be set to **"GitHub Actions"** (Settings → Pages), and `main` is branch-protected to require a PR and a passing `quality` check.

### Configuration / env

Client config is read from Vite env vars (`import.meta.env.VITE_*`). Copy `.env.example` → `.env` (gitignored) and set the `VITE_FIREBASE_*` values (RTDB base URL plus the Firebase web config for the SDK). Values are surfaced through `src/config.ts` and the SDK is initialised in `src/firebase.ts`. These are public client identifiers, not secrets.

> **Production-readiness backlog complete:** the hardening effort tracked in [GitHub issue #4](https://github.com/georgeharvey3/geotracks/issues/4) has landed in full — **CRA → Vite** and **Jest → Vitest** migrations (issue #12), Firebase leaderboard hardening (issue #17: SDK + anonymous auth + append-only rules), retirement of Cypress in favour of RTL/Vitest integration tests (issue #18), GitHub Actions CI/CD with PR-gated branch protection and automated Pages deploy (issue #19), the `App.tsx` refactor into reducer/context/hooks, and the docs/code-health cleanup (issue #20).

## Architecture

GeoTracks is a **React 18 + TypeScript** music geography guessing game (built with Vite, MUI for components/theming). Players listen to Spotify clips and guess the country of origin — by clicking it on the world map or by typing its name. Two game modes: **Infinite** (unlimited rounds) and **Competition** (10 turns with scoring and a Firebase-backed leaderboard).

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

### Map Interface

The world map (`src/Components/WorldMap/WorldMap.tsx`) is the primary guessing surface, always on, with the text box retained as a compact secondary input. Both feed the same `SUBMIT_GUESS` action, so the map is a **unified board**: it marks every guess of the round whichever input committed it. Rendering is **react-simple-maps** (inline SVG, `geoEqualEarth`, `ZoomableGroup` pan/zoom, no tile provider — ADR-0001).

- **Geometry** — Natural Earth 1:50m TopoJSON, committed at `src/map/countries-50m.topo.json` with each geometry's `id` already rewritten to the alpha-2 code used across the app. Generated by `node scripts/build-map-geometry.mjs` (re-run it after editing `src/countries.json`); see ADR-0002. `src/map/geography.ts` owns the join: `polygonCodes`, `stragglerMarkers`, and code↔name lookups.
- **Stragglers** — countries under 15,000 km² (and the handful Natural Earth omits) also get a clickable **point-marker** at their `countries.json` centroid, so every guessable country has a target. The marker is that country's labelled target; its polygon, if any, stays clickable underneath.
- **Commit-on-click** — a hovering pointer (`useHasHover`, i.e. `(hover: hover) and (pointer: fine)`) commits on a single click and previews via a hover tooltip; without one (touch), the first tap arms a country and a second tap on it commits.
- **Markings** — a wrong guess persists as **proximity heat** (`src/helpers/getProximityColor.ts`, a yellow→red scale where yellow is closest) plus a direction arrow and km label when geo-hints are on, and as one flat desaturated red — identical for every wrong guess, near or far — when they are off, so the map never leaks proximity the player opted out of. On round end the answer is revealed and the map stops accepting guesses.
- **Zoom-invariant furniture** — the map tracks the zoom level (`ZoomableGroup`'s `onMove`) and counter-scales straggler markers, hint arrows/labels and country outlines by `1/zoom`, so they keep their on-screen size: zooming in separates crowded island dots and stops hints blanketing the countries the player zoomed in to reach.
- **Not yet** — keyboard navigation of the map is deliberately deferred (issue #2); the text box remains the complete keyboard path, so map targets are `tabIndex={-1}`.

### Game screen layout

The game screen is full-bleed: `Base` switches to a fixed, non-scrolling viewport (`fullBleed`) where the title and home button become chrome floating over the map, and `Game` composes exactly two things — the map and `ControlPanel` (`src/Components/ControlPanel/ControlPanel.tsx`), which gathers the player, prompt, text input, hints toggle, guess board and round-end reveal into one surface.

Shared geometry lives in `src/layout.ts`, and the whole split follows from the world being roughly 2:1 in `geoEqualEarth`:

- **Landscape** (`LANDSCAPE_QUERY`, `min-aspect-ratio: 13/10`) — the map covers the viewport (`preserveAspectRatio="… slice"`, cropping the empty polar bands) and the panel floats over the top-right corner. It deliberately occludes part of the map; guesses hidden behind it are still reported in the panel's own board, and the map pans underneath.
- **Portrait** — covering would crop away most of the world's width, so the two stack instead: the panel becomes a bottom tray sized to its own content (capped at `PORTRAIT_PANEL_MAX_HEIGHT`, past which it scrolls), and the map fits the world into every pixel the tray leaves. The tray stays small because the guess board collapses to its latest entry (see below), so nothing in it has to scroll.

Nothing on this screen scrolls — the map claims touch gestures for pan/zoom (`touchAction: "none"`), so only the panel's own content may overflow.

The **guess board** (`src/Components/Guesses/Guesses.tsx`) shows only the latest guess by default, with a toggle to unfold the rest; the end of a round folds it back up so the reveal and Next Song button have the room. The map still carries every guess, so nothing is lost by keeping the board short. Because the panel is a short scrolling box, the country autocomplete opens in a `Popper` portalled out of it (and selects on click, not mousedown, so a dismissed list can't pass the click through to the map underneath).

### Geo Hints System

When enabled, incorrect guesses show distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) to the correct country. Uses the Haversine formula (`src/helpers/getDistance.ts`) and bearing calculation (`src/helpers/getBearing.ts`) with coordinates from `src/countries.json`.

### Key Files

- `src/state/gameReducer.ts` — Pure game reducer, plus scoring/mode constants (`SCORE_VALUES`, `NUM_COMPETITION_TURNS`, `MAX_COMPETITION_SCORE`, `GAME_MODES`)
- `src/context/GameContext.tsx` — `GameProvider` + `useGame()` / `useLeaderboard()` context hooks
- `src/hooks/` — Side-effect seams: `useSpotifyPlayer`, `useKeyboardShortcuts`, `useLeaderboard`, `useHasHover`
- `src/albums.json` — Array of `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Array of `{ code, name, lat, lon }` used for autocomplete, distance/bearing calculations, and the map join
- `src/map/` — Map geometry: generated `countries-50m.topo.json` + `stragglers.json`, and the `geography.ts` join
- `src/Components/WorldMap/WorldMap.tsx` — The clickable map (see “Map Interface”)
- `src/Components/ControlPanel/ControlPanel.tsx` — The controls panel floating over the map (see “Game screen layout”)
- `src/layout.ts` — Shared game-screen geometry: `LANDSCAPE_QUERY`/`LANDSCAPE_MEDIA`, `CHROME_CLEARANCE`, `PORTRAIT_PANEL_MAX_HEIGHT`
- `src/types.ts` — Shared TypeScript types
- `src/theme.ts` — MUI theme

### Testing

Vitest + React Testing Library only — Cypress is retired. `src/App.test.tsx` holds the integration suite: it mounts the real `<App>` (real reducer, context, routing, keyboard shortcuts) and `vi.mock`s only the two side-effectful seams, using the controllable fakes in `src/test/` (`spotifyPlayerFake.ts`, `leaderboardFake.ts`). The map is real in those tests apart from its pan/zoom wrapper (`zoomableGroupFake.tsx` — jsdom cannot run d3-zoom); `hoverCapability.ts` stubs `matchMedia` so a test can choose pointer or touch behaviour. Unit tests sit next to their subjects (`*.test.ts(x)`). `src/test-utils.tsx` re-exports RTL with a theme-wrapped `render`. TypeScript is strict (including `noUncheckedIndexedAccess` and unused-code checks — see `tsconfig.json`).

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
