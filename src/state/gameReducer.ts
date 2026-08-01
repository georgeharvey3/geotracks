import countriesJSON from "../countries.json";
import getDistance from "../helpers/getDistance";
import getBearing from "../helpers/getBearing";
import getDailySongs from "../helpers/getDailySongs";
import {
  DAILY_RUN_VERSION,
  DailyRunRecord,
  dayString,
} from "../helpers/dailyRun";
import { competitionAlbums, library } from "../music/library";
import {
  Album,
  LibraryAlbum,
  Song,
  SongMetadata,
  Guess,
  TurnOutcome,
  TurnResult,
} from "../types";

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
export const MAX_COMPETITION_SCORE = SCORE_VALUES[1]! * NUM_COMPETITION_TURNS;

// `screen` is the app's single router. Explore keeps its own state in its own
// reducer (ADR-0003), but which surface is on screen is decided in one place.
export type Screen =
  "menu" | "scoreboard" | "playing" | "runSummary" | "explore" | "suggest";

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
  /** Points this round has earned so far: 0 until the answer is named. */
  roundPoints: number;
  /**
   * The Run so far, one entry per retired turn — Competition only, since
   * Infinite has no end to summarise. Cleared when the Run is left behind.
   */
  turns: TurnResult[];
  nameInputValue: string;
  /** Whether this Run's score has been written to the leaderboard. One per Run. */
  scoreSubmitted: boolean;
  /**
   * The country the Suggestion form opens on, as an alpha-2 code, or "" when
   * the screen was reached from the menu with nobody in mind.
   *
   * This is the *whole* of what the game reducer knows about a Suggestion: the
   * router opening a screen with an argument, as `RESUME_RUN` opens one with a
   * record. The form's own state — the fields, their validity, the write in
   * flight — is local to it, and the write goes through `useSuggestions`. The
   * reducer has no business knowing about a Spotify link.
   */
  suggestCountryCode: string;
}

export type GameAction =
  // Infinite's way in. Competition arrives through the three Daily Run actions
  // below instead, so the day's record decides which one the menu offers.
  | { type: "SET_MODE"; mode: string }
  | { type: "START_RUN" }
  | { type: "RESUME_RUN"; record: DailyRunRecord }
  | { type: "SHOW_RUN_SUMMARY"; record: DailyRunRecord }
  | { type: "SHOW_SCOREBOARD" }
  | { type: "SHOW_EXPLORE" }
  // The country code is a prefill and nothing more: Explore dispatches it with
  // the country the player asked about, the menu dispatches it without one.
  | { type: "SHOW_SUGGEST"; countryCode?: string }
  | { type: "SUBMIT_GUESS"; countryAnswer: string }
  | { type: "TOGGLE_GEO_HINTS"; checked: boolean }
  | { type: "NEXT_SONG" }
  | { type: "RESET_TO_MENU" }
  | { type: "SET_NAME"; value: string }
  | { type: "SCORE_SUBMITTED" }
  | { type: "SET_SONG_METADATA"; link: string; metadata: SongMetadata };

/**
 * A Song drawn at random from the album pool, with its Album removed so a
 * session never plays the same record twice.
 *
 * This is what every draw *except* Competition's makes. The day's seeded list
 * belongs to the Daily Run alone (issue #49): a player who opens Infinite first
 * would otherwise hear today's Competition Songs, and then walk into the one Run
 * they get that day already holding the answers. The seed is there to make Runs
 * comparable between players, and there is no second Run to fall back on.
 */
function pickRandomSong(albums: Album[]): { song: Song; albums: Album[] } {
  const albumIndex = Math.floor(Math.random() * albums.length);
  // Invariant: the album pool outlasts any session (it only shrinks by one per
  // round), so a random in-range index always lands on an album with at least
  // one track.
  const album = albums[albumIndex]!;
  const trackIndex = Math.floor(Math.random() * album.tracks.length);

  return {
    song: {
      country: album.country,
      link: album.tracks[trackIndex]!,
      album: album.album_name,
    },
    albums: albums.filter((_, index) => index !== albumIndex),
  };
}

/**
 * The next Song of the day's seeded ten — Competition's draw, and the only one
 * that walks `dailySongIndex`. Past the end of the list the day has nothing left
 * to say, so it falls back to a random draw; with 785 Albums that is
 * unreachable, but a pool too small to seed ten Songs from must still yield a
 * Song rather than nothing.
 */
function pickDailySong(
  albums: Album[],
  dailySongs: Song[],
  dailySongIndex: number,
): { song: Song; albums: Album[]; dailySongIndex: number } {
  const song = dailySongs[dailySongIndex];
  if (song === undefined) {
    return { ...pickRandomSong(albums), dailySongIndex };
  }

  // The Song is already chosen; its Album leaves the pool so a later random
  // draw cannot land on the record the day has already spent.
  const albumIndex = albums.findIndex((a) => a.album_name === song.album);

  return {
    song,
    albums:
      albumIndex >= 0
        ? albums.filter((_, index) => index !== albumIndex)
        : albums,
    dailySongIndex: dailySongIndex + 1,
  };
}

export function createInitialState(
  albums: LibraryAlbum[] = library,
  today: string = dayString(new Date()),
): GameState {
  // Competition draws from the Library as it stood before today: a Community
  // album added by a deploy must not change the day's ten under anyone
  // part-way through them. Every other draw below takes the whole Library, so
  // Explore and Infinite have it the moment it ships.
  const dailySongs = getDailySongs(competitionAlbums(albums, today));
  // The Song the menu is standing on is the one Infinite opens with, and no
  // mode has been chosen yet — so it is drawn at random and the day is still
  // whole. `START_RUN` is what spends the day's first Song.
  const picked = pickRandomSong(albums);

  return {
    screen: "menu",
    gameMode: "",
    albums: picked.albums,
    dailySongs,
    dailySongIndex: 0,
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
    roundPoints: 0,
    turns: [],
    nameInputValue: "",
    scoreSubmitted: false,
    suggestCountryCode: "",
  };
}

// Fields reset at the start of each new round (next song / return to menu).
const roundReset = {
  guesses: [] as Guess[],
  submitted: false,
  finished: false,
  correct: false,
  errorMessage: "",
  roundPoints: 0,
};

// Fields reset when a Run begins or is left behind: everything a Run
// accumulates, back to nothing.
const runReset = {
  ...roundReset,
  geoHintsEnabled: false,
  showGeoHints: false,
  questionIndex: 0,
  turnIndex: 0,
  score: 0,
  turns: [] as TurnResult[],
  nameInputValue: "",
  scoreSubmitted: false,
};

/**
 * Open Competition on the day's first Song. The Run is *the day's seeded ten*,
 * so it is anchored at index 0 whatever else the session has drawn from the
 * list already — a Run that opened halfway down it would not be the Run
 * everyone else played.
 */
function startRun(state: GameState): GameState {
  const picked = pickDailySong(state.albums, state.dailySongs, 0);

  return {
    ...state,
    ...runReset,
    screen: "playing",
    gameMode: GAME_MODES.competition,
    song: picked.song,
    albums: picked.albums,
    dailySongIndex: picked.dailySongIndex,
  };
}

/**
 * The day's record, back as the Run it describes — the inbound half of the
 * mapping `dailyRunRecordFrom` is the outbound half of. Both directions are
 * written out field by field on purpose (ADR-0004): a field that matters to
 * persistence cannot be renamed without walking past them.
 */
function resumedRun(state: GameState, record: DailyRunRecord): GameState {
  // `dailySongIndex` is the *next* Song to draw, so the one in flight is the
  // one before it.
  const song = state.dailySongs[record.dailySongIndex - 1];
  // Fail open: a record we cannot land a Song from is a bug of ours, and the
  // player should get their Run rather than a dead button.
  if (!song) return startRun(state);

  const { round } = record;
  return {
    ...state,
    screen: "playing",
    gameMode: GAME_MODES.competition,
    song,
    dailySongIndex: record.dailySongIndex,
    turnIndex: record.turnIndex,
    questionIndex: record.turnIndex,
    score: record.score,
    turns: record.turns,
    scoreSubmitted: record.scoreSubmitted,
    nameInputValue: "",
    // The round in flight comes back with the Run. Restoring to a clean turn
    // boundary would let two wrong guesses plus a reload buy back a fresh
    // 150-point first attempt.
    guesses: round.guesses,
    submitted: round.guesses.length > 0,
    finished: round.finished,
    correct: round.correct,
    roundPoints: round.roundPoints,
    geoHintsEnabled: round.geoHintsEnabled,
    // Only the scoring flag is stored, because only it is owed to the Run. The
    // switch comes back on with it: the round has already been charged for the
    // hints, so showing them is the generous reading of a record that cannot
    // say whether the player had since hidden them.
    showGeoHints: round.geoHintsEnabled,
    errorMessage:
      round.finished && !round.correct ? `Answer was: ${song.country}` : "",
  };
}

/** The other way a record comes back: a Run already played, as its summary. */
function reopenedRunSummary(
  state: GameState,
  record: DailyRunRecord,
): GameState {
  return {
    ...state,
    ...runReset,
    screen: "runSummary",
    gameMode: GAME_MODES.competition,
    turnIndex: NUM_COMPETITION_TURNS,
    dailySongIndex: record.dailySongIndex,
    score: record.score,
    turns: record.turns,
    // Load-bearing: without it the name box comes back, and one score goes onto
    // the append-only leaderboard every time the summary is reopened.
    scoreSubmitted: record.scoreSubmitted,
  };
}

/**
 * The Run as the day's record, or `null` when the player is not on one. The
 * status is read from the Run's own turn count rather than the screen: the
 * record has to still read "finished" long after the player walked back to the
 * menu. See ADR-0004 for why this is a hand-mapped record and not a state dump.
 */
export function dailyRunRecordFrom(
  state: GameState,
  day: string,
): DailyRunRecord | null {
  if (state.gameMode !== GAME_MODES.competition) return null;

  return {
    v: DAILY_RUN_VERSION,
    date: day,
    status:
      state.turnIndex >= NUM_COMPETITION_TURNS ? "finished" : "in-progress",
    turnIndex: state.turnIndex,
    score: state.score,
    dailySongIndex: state.dailySongIndex,
    scoreSubmitted: state.scoreSubmitted,
    turns: state.turns,
    round: {
      guesses: state.guesses,
      geoHintsEnabled: state.geoHintsEnabled,
      finished: state.finished,
      correct: state.correct,
      roundPoints: state.roundPoints,
    },
  };
}

/**
 * The finished round, snapshotted as the Run's record of it. Called as the round
 * is retired, so `state` is still the round that just ended.
 */
function turnResultFrom(state: GameState): TurnResult {
  const outcome: TurnOutcome = !state.correct
    ? "missed"
    : state.guesses.length === 1
      ? "named-first"
      : "named-later";

  return {
    song: state.song,
    outcome,
    attempts: state.guesses.length,
    points: state.roundPoints,
    geoHintsUsed: state.geoHintsEnabled,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, gameMode: action.mode, screen: "playing" };

    // Starting the Daily Run spends the day. Nothing here consults storage —
    // the day's record is read above the reducer and arrives on the action.
    case "START_RUN":
      return startRun(state);

    case "RESUME_RUN":
      return resumedRun(state, action.record);

    // Today's Run, seen again. A finished Run outlives the session that played
    // it, so its summary is reopened from the record rather than from state.
    case "SHOW_RUN_SUMMARY":
      return reopenedRunSummary(state, action.record);

    case "SHOW_SCOREBOARD":
      return { ...state, screen: "scoreboard" };

    case "SHOW_EXPLORE":
      return { ...state, screen: "explore" };

    case "SHOW_SUGGEST":
      return {
        ...state,
        screen: "suggest",
        suggestCountryCode: action.countryCode ?? "",
      };

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
        const basePoints = SCORE_VALUES[state.guesses.length + 1] ?? 0;
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
          // Banked here so the Turn result can copy it rather than re-derive
          // the scoring rule in a second place.
          roundPoints: scoreDelta,
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

      // Everything the next round inherits except the Song itself, which each
      // branch below draws from its own list.
      const withRoundCleared: GameState = {
        ...state,
        ...roundReset,
        questionIndex: state.questionIndex + 1,
      };

      // Which list the next Song comes off is the whole of issue #49: the day's
      // seeded ten are Competition's, and Infinite draws at random beside them.
      if (state.gameMode === GAME_MODES.competition) {
        const picked = pickDailySong(
          state.albums,
          state.dailySongs,
          state.dailySongIndex,
        );
        const reachedFinalTurn = state.turnIndex === NUM_COMPETITION_TURNS - 1;

        return {
          ...withRoundCleared,
          song: picked.song,
          albums: picked.albums,
          dailySongIndex: picked.dailySongIndex,
          geoHintsEnabled: false,
          showGeoHints: false,
          turnIndex: state.turnIndex + 1,
          // The retired turn joins the Run's record. Only Competition keeps one:
          // Infinite never ends, so nothing would ever read it.
          turns: [...state.turns, turnResultFrom(state)],
          screen: reachedFinalTurn ? "runSummary" : withRoundCleared.screen,
        };
      }

      const picked = pickRandomSong(state.albums);
      return { ...withRoundCleared, song: picked.song, albums: picked.albums };
    }

    case "RESET_TO_MENU": {
      // The menu is nobody's mode, so its Song is a random one and the day is
      // left exactly as the player left it.
      const picked = pickRandomSong(state.albums);

      return {
        ...state,
        // Leaving the screen discards the Run *from state*. The day's record
        // outlives it in storage — that is what the menu reads to decide
        // whether today's Run is still to play, half-played or done.
        ...runReset,
        screen: "menu",
        gameMode: "",
        song: picked.song,
        albums: picked.albums,
        // The home button is the only way off the Suggestion form, so this is
        // where the country it opened on stops being anybody's business.
        suggestCountryCode: "",
      };
    }

    case "SET_NAME":
      return action.value.length <= 10
        ? { ...state, nameInputValue: action.value }
        : state;

    case "SCORE_SUBMITTED":
      return { ...state, scoreSubmitted: true };

    case "SET_SONG_METADATA":
      // Keyed by the link it was fetched for, so a late-resolving fetch cannot
      // put one Song's title on the next one.
      return action.link === state.song.link
        ? { ...state, song: { ...state.song, ...action.metadata } }
        : state;

    default:
      return state;
  }
}
