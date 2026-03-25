# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` — Run dev server (localhost:3000)
- `npm test` — Run tests in interactive watch mode (Jest via react-scripts)
- `npm run build` — Production build to `build/`
- `npm run deploy` — Build and deploy to GitHub Pages via gh-pages

## Architecture

GeoTracks is a React 18 music geography guessing game (Create React App). Players listen to Spotify tracks and guess the country of origin. Two game modes: **Infinite** (unlimited rounds) and **Competition** (10 turns with scoring and a Firebase-backed leaderboard).

### State Management

All game state lives in `src/App.js` via useState/useEffect hooks — there is no state management library. Components are purely presentational and receive everything through props.

### Spotify Integration

Song playback uses the Spotify oEmbed API to fetch embed HTML, rendered in a hidden iframe. Playback is controlled via `postMessage` to the iframe (`{ command: "toggle" }`). The app listens for `message` events from `https://open.spotify.com` to track ready/playing/paused/finished states.

### Scoring & Firebase

- Scores are stored in Firebase Realtime Database (`geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json`)
- Score values by guess attempt: 1st=150, 2nd=80, 3rd=60, 4th=40, 5th=20
- Enabling geo hints halves the score for that round
- Albums are removed from the pool after selection to prevent repeats within a session

### Geo Hints System

When enabled, incorrect guesses show distance (km) and compass direction (N/NE/E/SE/S/SW/W/NW) to the correct country. Uses Haversine formula (`src/helpers/getDistance.js`) and bearing calculation (`src/helpers/getBearing.js`) with coordinates from `src/countries.json`.

### Key Data Files

- `src/albums.json` — Array of `{ country, album_name, tracks: [spotify_urls] }`
- `src/countries.json` — Array of `{ code, name, lat, lon }` used for autocomplete and distance calculations

### Keyboard Shortcuts (registered in App.js)

- Space: toggle playback
- Enter: next song (when round finished)
- Typing auto-focuses the country input; Escape blurs it

### CountryInput Component

Custom autocomplete implementation using vanilla DOM manipulation (no library). Supports arrow key navigation, Enter to select, Escape to close.
