import albumsJSON from "../albums.json";
import countriesJSON from "../countries.json";
import getDistance from "../helpers/getDistance";
import getBearing from "../helpers/getBearing";
import getDailySongs from "../helpers/getDailySongs";
import { Album, Song, Guess } from "../types";

export const GAME_MODES = {
  infinite: "infinite",
  competition: "competition",
} as const;

// Points awarded by the guess attempt on which the answer is found.
export const SCORE_VALUES: Record<number, number> = {
  1: 150,
  2: 80,
  3: 60,
  4: 40,
  5: 20,
};

export const NUM_COMPETITION_TURNS = 10;

// Canonical maximum competition score: a perfect run is a first-guess correct
// answer with no geo-hints on every turn (SCORE_VALUES[1] * NUM_COMPETITION_TURNS).
// This is the upper bound the leaderboard `.validate` rule enforces (issue #7).
export const MAX_COMPETITION_SCORE = SCORE_VALUES[1] * NUM_COMPETITION_TURNS;

export type Screen = "menu" | "scoreboard" | "playing" | "finalScore";

export interface GameState {
  screen: Screen;
  // "" until a mode is chosen, then one of GAME_MODES.
  gameMode: string;
  albums: Album[];
  dailySongs: Song[];
  dailySongIndex: number;
  song: Song;
  guesses: Guess[];
  submitted: boolean;
  finished: boolean;
  correct: boolean;
  errorMessage: string;
  showGeoHints: boolean;
  geoHintsEnabled: boolean;
  questionIndex: number;
  turnIndex: number;
  score: number;
  nameInputValue: string;
}

export type GameAction =
  | { type: "SET_MODE"; mode: string }
  | { type: "SHOW_SCOREBOARD" }
  | { type: "SUBMIT_GUESS"; countryAnswer: string }
  | { type: "TOGGLE_GEO_HINTS"; checked: boolean }
  | { type: "NEXT_SONG" }
  | { type: "RESET_TO_MENU" }
  | { type: "SET_NAME"; value: string };

// Pure song selection: mirrors the daily-seeded-then-random pool behaviour.
// Returns the chosen song plus the album pool and daily index after selection.
function pickNextSong(
  albums: Album[],
  dailySongs: Song[],
  dailySongIndex: number,
): { song: Song; albums: Album[]; dailySongIndex: number } {
  let song: Song;
  let nextDailyIndex = dailySongIndex;
  let albumIndexToRemove = -1;

  if (dailySongIndex < dailySongs.length) {
    song = dailySongs[dailySongIndex];
    nextDailyIndex = dailySongIndex + 1;
    albumIndexToRemove = albums.findIndex((a) => a.album_name === song.album);
  } else {
    albumIndexToRemove = Math.floor(Math.random() * albums.length);
    const albumChoice = albums[albumIndexToRemove];
    const songIndexChoice = Math.floor(
      Math.random() * albumChoice.tracks.length,
    );
    song = {
      country: albumChoice.country,
      link: albumChoice.tracks[songIndexChoice],
      album: albumChoice.album_name,
    };
  }

  const nextAlbums =
    albumIndexToRemove >= 0
      ? albums.filter((_, index) => index !== albumIndexToRemove)
      : albums;

  return { song, albums: nextAlbums, dailySongIndex: nextDailyIndex };
}

export function createInitialState(albums: Album[] = albumsJSON): GameState {
  const dailySongs = getDailySongs(albums);
  const picked = pickNextSong(albums, dailySongs, 0);

  return {
    screen: "menu",
    gameMode: "",
    albums: picked.albums,
    dailySongs,
    dailySongIndex: picked.dailySongIndex,
    song: picked.song,
    guesses: [],
    submitted: false,
    finished: false,
    correct: false,
    errorMessage: "",
    showGeoHints: false,
    geoHintsEnabled: false,
    questionIndex: 0,
    turnIndex: 0,
    score: 0,
    nameInputValue: "",
  };
}

// Fields reset at the start of each new round (next song / return to menu).
const roundReset = {
  guesses: [] as Guess[],
  submitted: false,
  finished: false,
  correct: false,
  errorMessage: "",
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, gameMode: action.mode, screen: "playing" };

    case "SHOW_SCOREBOARD":
      return { ...state, screen: "scoreboard" };

    case "SUBMIT_GUESS": {
      const { countryAnswer } = action;
      const guessedCountry = countriesJSON.find(
        (country) => country.name.toLowerCase() === countryAnswer.toLowerCase(),
      );

      if (!guessedCountry) {
        return {
          ...state,
          errorMessage: `Unrecognised country: '${countryAnswer}'`,
        };
      }

      if (countryAnswer.toLowerCase() === state.song.country.toLowerCase()) {
        // Correct: award the base points for this attempt number, halved when
        // geo-hints were enabled for the round (matches the documented design).
        const basePoints = SCORE_VALUES[state.guesses.length + 1];
        const scoreDelta = state.geoHintsEnabled ? basePoints / 2 : basePoints;

        return {
          ...state,
          submitted: true,
          errorMessage: "",
          guesses: [
            ...state.guesses,
            { country: countryAnswer, correct: true },
          ],
          finished: true,
          correct: true,
          score: state.score + scoreDelta,
        };
      }

      // Incorrect: record the guess with distance/direction to the answer.
      const correctCountry = countriesJSON.find(
        (country) => country.name === state.song.country,
      )!;

      const distance = getDistance(
        parseFloat(guessedCountry.lat),
        parseFloat(guessedCountry.lon),
        parseFloat(correctCountry.lat),
        parseFloat(correctCountry.lon),
      );
      const direction = getBearing(
        parseFloat(guessedCountry.lat),
        parseFloat(guessedCountry.lon),
        parseFloat(correctCountry.lat),
        parseFloat(correctCountry.lon),
      );

      const guesses = [
        ...state.guesses,
        { country: countryAnswer, correct: false, distance, direction },
      ];

      // Out of attempts after 5 wrong guesses: reveal the answer.
      const outOfGuesses = guesses.length > 4;

      return {
        ...state,
        submitted: true,
        errorMessage: outOfGuesses ? `Answer was: ${state.song.country}` : "",
        guesses,
        finished: outOfGuesses,
      };
    }

    case "TOGGLE_GEO_HINTS":
      // Checking enables hints for scoring; unchecking only hides them (the
      // score penalty stays applied for the round, matching prior behaviour).
      return action.checked
        ? { ...state, showGeoHints: true, geoHintsEnabled: true }
        : { ...state, showGeoHints: false };

    case "NEXT_SONG": {
      if (!state.finished) {
        return state;
      }

      const picked = pickNextSong(
        state.albums,
        state.dailySongs,
        state.dailySongIndex,
      );

      const base: GameState = {
        ...state,
        ...roundReset,
        questionIndex: state.questionIndex + 1,
        song: picked.song,
        albums: picked.albums,
        dailySongIndex: picked.dailySongIndex,
      };

      if (state.gameMode === GAME_MODES.competition) {
        const reachedFinalTurn = state.turnIndex === NUM_COMPETITION_TURNS - 1;
        return {
          ...base,
          geoHintsEnabled: false,
          showGeoHints: false,
          turnIndex: state.turnIndex + 1,
          screen: reachedFinalTurn ? "finalScore" : base.screen,
        };
      }

      return base;
    }

    case "RESET_TO_MENU": {
      const picked = pickNextSong(
        state.albums,
        state.dailySongs,
        state.dailySongIndex,
      );

      return {
        ...state,
        ...roundReset,
        screen: "menu",
        gameMode: "",
        geoHintsEnabled: false,
        showGeoHints: false,
        questionIndex: 0,
        turnIndex: 0,
        score: 0,
        song: picked.song,
        albums: picked.albums,
        dailySongIndex: picked.dailySongIndex,
      };
    }

    case "SET_NAME":
      return action.value.length <= 10
        ? { ...state, nameInputValue: action.value }
        : state;

    default:
      return state;
  }
}
