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

GeoTracks is a **React 18 + TypeScript** music geography app (built with Vite, MUI for components/theming) built on one world map. In the **game**, players listen to Spotify clips and guess the country of origin — by clicking it on the map or by typing its name; two game modes, **Infinite** (unlimited rounds) and **Competition** (10 turns with scoring and a Firebase-backed leaderboard). A completed Competition **Run** ends on the **Run summary**. In **Explore**, they choose a country in order to listen to it. `CONTEXT.md` pins the vocabulary (Song, Album, Clip, Game mode, Explore, Playable country, Country queue, Skip, Run, Turn result, Turn outcome, Run summary).

### State Management

Game state lives in a pure reducer (`src/state/gameReducer.ts`) exposed through React context (`src/context/GameContext.tsx`) — there is no state management library. `GameProvider` owns the single `useReducer` instance (plus the leaderboard hook) and components consume it via the `useGame()` / `useLeaderboard()` context hooks. `src/App.tsx` is now just a thin screen router that switches on `state.screen` (`menu` | `playing` | `scoreboard` | `runSummary` | `explore`). Side effects are isolated in hooks under `src/hooks/`:

- `useSpotifyPlayer` — the entire imperative Spotify IFrame integration (controller lifecycle, oEmbed metadata, retries)
- `useKeyboardShortcuts` — document-level key handlers for the map screens
- `useLeaderboard` — all Firebase leaderboard reads/writes

`src/Components/GameScreen/GameScreen.tsx` is the container that wires the player and keyboard hooks to the reducer; everything below it (under `src/Components/`) stays purely presentational and receives everything through props.

Explore has a reducer (`src/state/exploreReducer.ts`) and provider (`src/context/ExploreContext.tsx`) of its own, mounted as a **sibling** of the game's — neither reads the other. `screen` stays the single router inside the game reducer, so there is exactly one place that decides what is on screen (ADR-0003).

### Spotify Integration

Playback uses the **Spotify IFrame API**, wrapped entirely by `src/hooks/useSpotifyPlayer.ts`: a controller is created against a hidden embed element (`IFrameAPI.createController`) and driven programmatically (`controller.togglePlay()`, `controller.loadUri()`). Track title, artist, and thumbnail are fetched separately from the **Spotify oEmbed API** (`https://open.spotify.com/oembed?url=...`). Ready/playing/paused/finished states come from the controller's `ready` and `playback_update` listeners, and the hook has automatic retries plus a manual retry fallback when a track fails to load.

The hook reports metadata together with the **link it was fetched for** (`metadata` + `metadataLink`), because the two must never be read apart: a fetch that resolves after the Song has moved on would otherwise put one Song's title on the next. The game hands both to the reducer (`SET_SONG_METADATA`), which merges the metadata onto `state.song` only when the link still matches — so the reducer owns the displayed Song and the Run summary can snapshot the Song the player actually heard. Explore merges for display only, under the same link check.

The hook takes an optional **Clip cap** (`clipDurationMs`). The game passes 30 s (`CLIP_DURATION_MS` in `GameScreen`) and the hook pauses the embed there; Explore passes none, so a listener signed in to Spotify hears the whole Song and everyone else still gets Spotify's own preview limit. That splits end-of-Song detection in two: **capped**, the end is the cap; **uncapped**, `position >= duration` is unreliable — the embed reports the full Song's duration to a listener who is not signed in while playing only its ~30 s preview, so position never gets there. What holds either way is that _playback stopped and we were not the ones who stopped it_, so the hook tracks pauses it asked for (`togglePlay`) and treats any other stop as the Song ending. **This has not been verified against a real embed** — see the note in issue #37.

### Scoring & Firebase

- Scores are stored in Firebase Realtime Database via the **Firebase JS SDK** with **anonymous auth**, all behind the `useLeaderboard` hook (`src/hooks/useLeaderboard.ts`); the SDK is initialised in `src/firebase.ts`. `submitScore` deliberately **does not reload the page** — the Run summary the player is reading sits on the same screen as the name box, so the write is confirmed in place (`SCORE_SUBMITTED`, one per Run) and the read subscription brings the new record back on its own. Records are append-only (`scores/{pushId}: { name, score, createdAt }`, written with `push()`); reads are bounded (`orderByChild("score").limitToLast(20)`). Access is locked down by committed security rules (`database.rules.json` + `firebase.json`): public read, per-record create-only write (`auth != null && !data.exists()`), and strict `.validate` (name 1–10 chars, integer score 0–1500, `createdAt == now`, no extra fields). Deploy with `firebase deploy --only database`; migrate legacy `{name:score}` data first via `node scripts/migrate-scores.mjs --apply`.
- Score values by guess attempt: 1st=150, 2nd=80, 3rd=60, 4th=40, 5th=20
- Enabling geo hints halves the score for that round
- Canonical competition score range is **0–1500** (`MAX_COMPETITION_SCORE` in `src/state/gameReducer.ts` = `SCORE_VALUES[1] * NUM_COMPETITION_TURNS`, i.e. 10 first-guess correct answers with no hints). This is the bound the leaderboard `.validate` rule enforces (issue #7).
- Each calendar day starts with the same seeded song set (`src/helpers/getDailySongs.ts`, Mulberry32 PRNG) so scores are comparable; once exhausted, songs are random. Albums are removed from the pool after selection to prevent repeats within a session.

### Map Interface

The world map splits into a **surface-neutral base** (`src/Components/WorldMap/BaseMap.tsx`) and one thin wrapper per surface (ADR-0003). The base owns how a country is picked and nothing about what picking means: the projection, bounded panning, the `1/zoom` counter-scale, straggler markers, the hover tooltip and commit-on-click. Its caller supplies the fill for a country (`fillFor`), whether it may be chosen (`selectable`), what the tooltip says (`labelFor`), the touch rule (`armOnTouch`), per-country marking attributes and an optional `overlay`. **The base must stay state-agnostic** — the moment it branches on which surface is calling, the split has failed and a `mode` prop has been rebuilt by accident. Shared palette entries live in `src/map/fills.ts`.

The three wrappers are `WorldMap.tsx` (guessing), `src/Components/ExploreMap/ExploreMap.tsx` (Explore) and `src/Components/RunSummaryMap/RunSummaryMap.tsx` (the Run summary).

The guessing map is the primary guessing surface, always on, with the text box retained as a compact secondary input. Both feed the same `SUBMIT_GUESS` action, so the map is a **unified board**: it marks every guess of the round whichever input committed it. Rendering is **react-simple-maps** (inline SVG, `geoEqualEarth`, `ZoomableGroup` pan/zoom, no tile provider — ADR-0001).

- **Geometry** — Natural Earth 1:50m TopoJSON, committed at `src/map/countries-50m.topo.json` with each geometry's `id` already rewritten to the alpha-2 code used across the app. Generated by `node scripts/build-map-geometry.mjs` (re-run it after editing `src/countries.json`); see ADR-0002. `src/map/geography.ts` owns the join: `polygonCodes`, `stragglerMarkers`, and code↔name lookups.
- **Stragglers** — countries under 15,000 km² (and the handful Natural Earth omits) also get a clickable **point-marker** at their `countries.json` centroid, so every guessable country has a target. The marker is that country's labelled target; its polygon, if any, stays clickable underneath.
- **Commit-on-click** — a hovering pointer (`useHasHover`, i.e. `(hover: hover) and (pointer: fine)`) commits on a single click and previews via a hover tooltip; without one (touch), the first tap arms a country and a second tap on it commits. The touch rule is a **parameter** of the base map, not a property of it: the arm-then-commit guard exists to protect an irreversible Guess, so Explore, which has nothing irreversible to protect, passes `armOnTouch={false}` and commits on one tap.
- **Markings** — a wrong guess persists as **proximity heat** (`src/helpers/getProximityColor.ts`, a yellow→red scale where yellow is closest) plus a direction arrow and km label when geo-hints are on, and as one flat desaturated red — identical for every wrong guess, near or far — when they are off, so the map never leaks proximity the player opted out of. On round end the answer is revealed and the map stops accepting guesses.
- **Bounded panning** — `ZoomableGroup`'s `translateExtent` is pinned to the map's own viewBox (`[[0,0],[800,400]]`), the same box d3-zoom measures its extent from, so the viewport can never leave the world. At zoom 1 that pins the map outright; zoomed in, the player can reach any edge but can't drag the world off into empty sea and lose it.
- **Zoom-invariant furniture** — the map tracks the zoom level (`ZoomableGroup`'s `onMove`) and counter-scales straggler markers, hint arrows/labels and country outlines by `1/zoom`, so they keep their on-screen size: zooming in separates crowded island dots and stops hints blanketing the countries the player zoomed in to reach.
- **Hover tooltip** — the country name that follows the cursor is positioned by writing `left`/`top` straight onto its DOM node (rAF-coalesced), not through React state. Pointer moves outnumber every other event on this screen, and routing them through state re-rendered all ~250 country paths per mousemove.
- **Not yet** — keyboard navigation of the map is deliberately deferred on both surfaces (issues #2, #37); the text box remains the complete keyboard path, so map targets are `tabIndex={-1}`.

### Game screen layout

The game screen is full-bleed: `Base` switches to a fixed, non-scrolling viewport (`fullBleed`) where the title and home button become chrome floating over the map, and `Game` composes exactly two things — the map and `ControlPanel` (`src/Components/ControlPanel/ControlPanel.tsx`), which gathers the player, prompt, text input, hints toggle, guess board and round-end reveal into one surface.

Shared geometry lives in `src/layout.ts`, and the whole split follows from the world being roughly 2:1 in `geoEqualEarth`:

- **Landscape** (`LANDSCAPE_QUERY`, `min-aspect-ratio: 13/10`) — the map covers the viewport (`preserveAspectRatio="… slice"`, cropping the empty polar bands) and the panel floats over the top-right corner. It deliberately occludes part of the map; guesses hidden behind it are still reported in the panel's own board, and the map pans underneath.
- **Portrait** — covering would crop away most of the world's width, so the two stack instead: the panel becomes a bottom tray sized to its own content (capped at `PORTRAIT_PANEL_MAX_HEIGHT`, past which it scrolls), and the map fits the world into every pixel the tray leaves. The tray stays small because the guess board collapses to its latest entry (see below), so nothing in it has to scroll.

Nothing on this screen scrolls — the map claims touch gestures for pan/zoom (`touchAction: "none"`), so only the panel's own content may overflow.

The **guess board** (`src/Components/Guesses/Guesses.tsx`) shows only the latest guess by default, with a toggle to unfold the rest; the end of a round folds it back up so the reveal and Next Song button have the room. The map still carries every guess, so nothing is lost by keeping the board short. Because the panel is a short scrolling box, the country autocomplete opens in a `Popper` portalled out of it (and selects on click, not mousedown, so a dismissed list can't pass the click through to the map underneath).

### Explore

**Explore** (issue #37) is the surface where a player chooses a country in order to listen to it. It is **not a Game mode**: nothing is scored, recorded or submitted, there are no rounds, Guesses or Attempts, and it never touches the game's album pool, daily seeding, score or turn counter. It is reached from a third primary button on the menu (`SHOW_EXPLORE`), and it wears the same full-bleed layout as the game screen — map covering the viewport with `ExplorePanel` floating over a corner in landscape, a content-sized bottom tray in portrait (both via the shared `PanelSurface`).

- **Playable countries** — a country is Playable when the app holds at least one Album for it: 123 of 245 today (121 polygons, 15 of the 87 straggler markers). Non-playable countries take the inert-land fill, keep the default cursor and ignore clicks, but **still show their name on hover** — an absence of music is not an absence of geography. Shapes the app has no country for at all look identical and differ only in having no name to show.
- **Fills** — four flat states: inert land (non-playable), land (Playable), the near-white highlight (hover), and green for the country now playing. No rings or halos; Explore leaves the base map's `overlay` slot unused.
- **Country queue** — built on first selection from all of a country's Albums' Songs, shuffled. Skip advances it; it is exhausted before any Song repeats, then drawn afresh and continued (the fresh draw never opens with the Song just heard). Returning to a country **resumes** rather than restarts. Choosing the country already playing is a no-op.
- **Playback** — choosing a country or skipping starts playback automatically on every device (the click on the map is itself the user gesture, so the game's desktop-width gate is deliberately not carried over). A finished Song advances the queue; pausing stops that run, because auto-advance is driven by the finished signal and nothing else. The track card is shown **un-gated** from the first note — artwork, title, artist, Album and the Spotify link — because Explore has nothing to withhold.
- **Keyboard** — the same shortcuts as the game, with next-song wired to Skip: Space plays/pauses, Enter skips, any other key focuses the country input, Escape blurs it. `CountryInput` takes an optional `countries` list (defaulting to all of them, so the game is unaffected); Explore passes only the Playable ones, so the suggestions can never dead-end.
- **Lifetime** — leaving Explore unmounts the player and therefore stops the music; the queues live in the provider above the screen, so a trip to the menu and back within a visit keeps the player's place. Nothing is persisted across a page reload — no storage, no schema to version.

### Run summary

The **Run summary** (issue #3) is where a completed Competition **Run** ends — the only place a Run is ever seen whole. It answers both questions a player has at the end: how did I do, and _what was that track?_ **Competition only**: Infinite has no end to summarise.

It is the third full-bleed map surface, wearing the game screen's layout exactly (map covering the viewport with `RunSummaryPanel` floating over a corner in landscape, a scrolling bottom tray in portrait, both via the shared `PanelSurface`). No player mounts here — the rows identify each Song and hand off to Spotify, and Explore is where music is actually listened to.

- **The Run lives in the game reducer** — `turns: TurnResult[]`, appended by `NEXT_SONG` (already where a round is retired) and cleared by `RESET_TO_MENU`. Unlike Explore this is derived from the game's own Run, so ADR-0003's single-router rule holds and no second reducer is needed. `SUBMIT_GUESS` banks the round's points (`roundPoints`) so the scoring rule is never re-derived in a second place.
- **The panel, in this order** — the score headline and an "N of 10 named" line (the score alone doesn't say whether 340 points came from eight lucky third guesses or four clean ones); then the leaderboard name box, so it and the confirmation that replaces it are above the fold on any device; then the ten **Turn result** rows, scrolling inside the panel. Each row carries artwork, track title, artist, country, Album, a Spotify link, the Turn outcome with attempts used and points earned, and a **GeoHints** chip on turns played with hints on — the only thing that explains a halved points figure. Missing metadata falls back to "Unknown Track" / "Unknown Artist", as `TrackReveal` already does.
- **The map** marks only the Run's **answer** countries, in three fills by Turn outcome (`OUTCOME_FILLS` in `src/map/fills.ts`: green / amber / red). Wrong guesses are not marked — the Run doesn't keep them, and the surface is a picture of where the music came from rather than a trace of mistakes. `selectable={false}` throughout, so nothing commits; hover still names every country and pan/zoom come free from the base.
- **A country can answer twice in one Run** — the daily seed splices out the Album, not the country, and 88 countries hold more than one Album. A marked shape is therefore not a 1:1 index of a turn: the **rows are the record**, the map is the picture, and a shape carries its country's _best_ outcome.
- **Row → map** — hovering a row lights that row's country. Pointer-only (`useHasHover`); on touch the country printed in every row carries the job instead.
- **Exits** — the floating home button, plus the leaderboard button that appears in place of the name box once the score is saved. **No "Play again"**: `RESET_TO_MENU` keeps the shrunken album pool and the advanced `dailySongIndex`, so a second Run in the same session draws random songs rather than the day's seeded ten, and a replay shortcut would advertise a Run that isn't comparable.
- **Lifetime** — in memory only, like Explore's queues. Leaving the screen discards the Run and a reload loses it; persisting it belongs with #1, which has to introduce device storage anyway.

### Geo Hints System

When enabled, incorrect guesses show distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) to the correct country. Uses the Haversine formula (`src/helpers/getDistance.ts`) and bearing calculation (`src/helpers/getBearing.ts`) with coordinates from `src/countries.json`.

### Key Files

- `src/state/gameReducer.ts` — Pure game reducer, plus scoring/mode constants (`SCORE_VALUES`, `NUM_COMPETITION_TURNS`, `MAX_COMPETITION_SCORE`, `GAME_MODES`), the Run's `turns`, and the `Screen` router type
- `src/state/exploreReducer.ts` — Pure Explore reducer: Playable countries, the selected country and each Country queue, plus the `currentSong()` selector
- `src/context/GameContext.tsx` — `GameProvider` + `useGame()` / `useLeaderboard()` context hooks
- `src/context/ExploreContext.tsx` — `ExploreProvider` + `useExplore()`, mounted as GameProvider's sibling
- `src/hooks/` — Side-effect seams: `useSpotifyPlayer`, `useKeyboardShortcuts`, `useLeaderboard`, `useHasHover`
- `src/albums.json` — Array of `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Array of `{ code, name, lat, lon }` used for autocomplete, distance/bearing calculations, and the map join
- `src/map/` — Map geometry: generated `countries-50m.topo.json` + `stragglers.json`, the `geography.ts` join, and the shared `fills.ts` palette
- `src/Components/WorldMap/BaseMap.tsx` — The surface-neutral map (see “Map Interface”)
- `src/Components/WorldMap/WorldMap.tsx` — The guessing wrapper around it
- `src/Components/ExploreMap/ExploreMap.tsx` — The Explore wrapper around it
- `src/Components/RunSummaryMap/RunSummaryMap.tsx` — The Run summary wrapper around it
- `src/Components/ExploreScreen/ExploreScreen.tsx` — Explore's container: player + keyboard seams wired to the Explore reducer
- `src/Components/RunSummaryScreen/RunSummaryScreen.tsx` — The Run summary's container: the leaderboard write wired to the game reducer
- `src/Components/RunSummary/RunSummary.tsx` — The Run summary's layout, and the row→map highlight
- `src/Components/PanelSurface/PanelSurface.tsx` — The panel treatment all three control panels sit on
- `src/Components/ControlPanel/ControlPanel.tsx` — The game's controls panel (see “Game screen layout”)
- `src/Components/ExplorePanel/ExplorePanel.tsx` — Explore's controls panel (see “Explore”)
- `src/Components/RunSummaryPanel/RunSummaryPanel.tsx` — The Run summary's panel (see “Run summary”)
- `src/Components/TurnResultRow/TurnResultRow.tsx` — One turn of the Run, as a row
- `src/Components/AlbumArt/AlbumArt.tsx` — A Song's artwork with its placeholder, shared by the reveal card and the summary rows
- `src/layout.ts` — Shared game-screen geometry: `LANDSCAPE_QUERY`/`LANDSCAPE_MEDIA`, `CHROME_CLEARANCE`, `PORTRAIT_PANEL_MAX_HEIGHT`
- `src/types.ts` — Shared TypeScript types
- `src/theme.ts` — MUI theme

### Testing

Vitest + React Testing Library only — Cypress is retired. Two integration suites mount the real `<App>` (real reducers, context, routing, keyboard shortcuts) and `vi.mock` only the side-effectful seams, using the controllable fakes in `src/test/` (`spotifyPlayerFake.ts`, `leaderboardFake.ts`): `src/App.test.tsx` for the game and `src/Explore.test.tsx` for Explore. The map is real in those tests apart from its pan/zoom wrapper (`zoomableGroupFake.tsx` — jsdom cannot run d3-zoom); `hoverCapability.ts` stubs `matchMedia` so a test can choose pointer or touch behaviour. Unit tests sit next to their subjects (`*.test.ts(x)`). `src/test-utils.tsx` re-exports RTL with a theme-wrapped `render`. TypeScript is strict (including `noUncheckedIndexedAccess` and unused-code checks — see `tsconfig.json`).

The Run summary is covered from `src/App.test.tsx` (a Competition Run played to completion, asserting the panel, the rows and the map behind them) plus component tests for the pieces a whole Run can't pin down deterministically: `RunSummaryMap.test.tsx` (the three outcome fills, and a country that answered twice), `RunSummary.test.tsx` (the row→map highlight, on a pointer and on touch) and `RunSummaryPanel.test.tsx` (the panel's own states: the named count, the save button, the saved confirmation and the failed write). Three notes for anyone adding to these:

- **Today's ten are not ten countries.** The daily seed can hand the same country to two turns, so nothing may assume a country identifies a turn — `turnsWithSoleAnswers()` in the suite picks turns that do.
- **Guesses in the Run helpers go through the map**, not the text box: typing re-renders the world's ~250 shapes on every keystroke, and ten turns of it took the suite from 16s to 74s.
- **Hover assertions use `fireEvent.mouseEnter`**, as the map's own hover tests do; a hover update is low priority and `userEvent.hover`'s `act` does not settle it before the assertion.

No new mocking boundaries have been added for Explore — it reuses those four, plus Album data injected as a **default parameter** (`createInitialExploreState(albums = albumsJSON)`, mirroring `createInitialState`). Because the Country queue is shuffled, **no test may assert which Song plays first**; every property tested is invariant under any shuffle, and the Song currently playing is observed through the track card's Spotify link, whose address comes from the real reducer rather than the fake. Note also that the map's ~250 country shapes are drawn a tick after the screen mounts, so a test must `await screen.findByLabelText(...)` before reaching for a country.

### Keyboard Shortcuts (`src/hooks/useKeyboardShortcuts.ts`, wired in `GameScreen` and `ExploreScreen`)

- Space: toggle playback
- Enter: next song (when round finished) — in Explore, Skip
- Typing auto-focuses the country input; Escape blurs it

### CountryInput Component

Custom autocomplete (`src/Components/CountryInput/`) built with React state — no external autocomplete library. Supports arrow-key navigation, Enter to select, and Escape/click-outside to close. The optional `countries` prop narrows the suggestion list (Explore passes the Playable countries); it defaults to every country.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to identically-named labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
