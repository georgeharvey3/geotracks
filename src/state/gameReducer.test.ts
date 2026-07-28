import {
  gameReducer,
  createInitialState,
  GameState,
  GAME_MODES,
  NUM_COMPETITION_TURNS,
  MAX_COMPETITION_SCORE,
} from "./gameReducer";
import { Song } from "../types";

const FRANCE_SONG: Song = {
  country: "France",
  link: "https://open.spotify.com/track/abc",
  album: "Test Album",
};

// Build a controllable state rather than the seeded initial state so scoring
// and transitions can be asserted against a known song/country.
function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState(),
    screen: "playing",
    gameMode: GAME_MODES.competition,
    song: FRANCE_SONG,
    guesses: [],
    score: 0,
    geoHintsEnabled: false,
    ...overrides,
  };
}

describe("gameReducer", () => {
  describe("SUBMIT_GUESS scoring", () => {
    // Without geo-hints, the score is the base SCORE_VALUES for the attempt
    // (150/80/60/40/20). A perfect competition run is therefore 10 * 150 = 1500.
    it.each([
      [0, 150],
      [1, 80],
      [2, 60],
      [3, 40],
      [4, 20],
    ])(
      "awards %i-prior-guesses -> %i points without geo-hints",
      (priorGuesses, expected) => {
        const guesses = Array.from({ length: priorGuesses }, () => ({
          country: "Spain",
          correct: false,
        }));
        const next = gameReducer(stateWith({ guesses }), {
          type: "SUBMIT_GUESS",
          countryAnswer: "France",
        });
        expect(next.score).toBe(expected);
        expect(next.correct).toBe(true);
        expect(next.finished).toBe(true);
      },
    );

    it("halves points when geo-hints are enabled (first guess -> 75)", () => {
      const next = gameReducer(stateWith({ geoHintsEnabled: true }), {
        type: "SUBMIT_GUESS",
        countryAnswer: "France",
      });
      expect(next.score).toBe(75);
    });

    it("reaches the canonical 1500 max on a perfect competition run", () => {
      // 10 turns, each a first-guess correct with no geo-hints = 10 * 150.
      let state = stateWith({ turnIndex: 0 });
      for (let turn = 0; turn < NUM_COMPETITION_TURNS; turn += 1) {
        // NEXT_SONG picks a real song from the pool, so re-pin France each turn.
        state = { ...state, song: FRANCE_SONG };
        state = gameReducer(state, {
          type: "SUBMIT_GUESS",
          countryAnswer: "France",
        });
        state = gameReducer(state, { type: "NEXT_SONG" });
      }
      expect(state.score).toBe(MAX_COMPETITION_SCORE);
      expect(state.score).toBe(1500);
    });

    it("is case-insensitive on the correct answer", () => {
      const next = gameReducer(stateWith(), {
        type: "SUBMIT_GUESS",
        countryAnswer: "france",
      });
      expect(next.correct).toBe(true);
    });

    it("records distance and direction on an incorrect guess", () => {
      const next = gameReducer(stateWith(), {
        type: "SUBMIT_GUESS",
        countryAnswer: "Japan",
      });
      expect(next.correct).toBe(false);
      expect(next.finished).toBe(false);
      expect(next.guesses).toHaveLength(1);
      expect(next.guesses[0]!.distance).toBeGreaterThan(0);
      expect(next.guesses[0]!.direction).toBeTruthy();
    });

    it("rejects an unrecognised country without submitting", () => {
      const next = gameReducer(stateWith(), {
        type: "SUBMIT_GUESS",
        countryAnswer: "Atlantis",
      });
      expect(next.errorMessage).toBe("Unrecognised country: 'Atlantis'");
      expect(next.submitted).toBe(false);
      expect(next.guesses).toHaveLength(0);
    });

    it("reveals the answer after a 5th wrong guess", () => {
      const guesses = Array.from({ length: 4 }, () => ({
        country: "Japan",
        correct: false,
      }));
      const next = gameReducer(stateWith({ guesses }), {
        type: "SUBMIT_GUESS",
        countryAnswer: "Japan",
      });
      expect(next.finished).toBe(true);
      expect(next.errorMessage).toBe("Answer was: France");
    });
  });

  describe("screen transitions", () => {
    it("SET_MODE moves to the playing screen", () => {
      const next = gameReducer(createInitialState(), {
        type: "SET_MODE",
        mode: GAME_MODES.infinite,
      });
      expect(next.screen).toBe("playing");
      expect(next.gameMode).toBe(GAME_MODES.infinite);
    });

    it("SHOW_SCOREBOARD moves to the scoreboard screen", () => {
      const next = gameReducer(createInitialState(), {
        type: "SHOW_SCOREBOARD",
      });
      expect(next.screen).toBe("scoreboard");
    });

    it("NEXT_SONG is ignored until the round is finished", () => {
      const state = stateWith({ finished: false });
      expect(gameReducer(state, { type: "NEXT_SONG" })).toBe(state);
    });

    it("NEXT_SONG advances the question and clears the round", () => {
      const state = stateWith({
        finished: true,
        submitted: true,
        guesses: [{ country: "Spain", correct: false }],
        questionIndex: 2,
      });
      const next = gameReducer(state, { type: "NEXT_SONG" });
      expect(next.questionIndex).toBe(3);
      expect(next.finished).toBe(false);
      expect(next.submitted).toBe(false);
      expect(next.guesses).toHaveLength(0);
    });

    it("NEXT_SONG reaches the final score on the last competition turn", () => {
      const state = stateWith({
        finished: true,
        turnIndex: NUM_COMPETITION_TURNS - 1,
      });
      const next = gameReducer(state, { type: "NEXT_SONG" });
      expect(next.screen).toBe("finalScore");
      expect(next.turnIndex).toBe(NUM_COMPETITION_TURNS);
    });

    it("RESET_TO_MENU clears mode and score back to the menu", () => {
      const state = stateWith({
        finished: true,
        score: 500,
        turnIndex: 4,
        questionIndex: 4,
      });
      const next = gameReducer(state, { type: "RESET_TO_MENU" });
      expect(next.screen).toBe("menu");
      expect(next.gameMode).toBe("");
      expect(next.score).toBe(0);
      expect(next.turnIndex).toBe(0);
      expect(next.questionIndex).toBe(0);
    });
  });

  describe("geo-hints and name", () => {
    it("enabling geo-hints sets both the visible and scoring flags", () => {
      const next = gameReducer(stateWith(), {
        type: "TOGGLE_GEO_HINTS",
        checked: true,
      });
      expect(next.showGeoHints).toBe(true);
      expect(next.geoHintsEnabled).toBe(true);
    });

    it("disabling geo-hints only hides them (penalty persists)", () => {
      const enabled = gameReducer(stateWith(), {
        type: "TOGGLE_GEO_HINTS",
        checked: true,
      });
      const disabled = gameReducer(enabled, {
        type: "TOGGLE_GEO_HINTS",
        checked: false,
      });
      expect(disabled.showGeoHints).toBe(false);
      expect(disabled.geoHintsEnabled).toBe(true);
    });

    it("caps the name input at 10 characters", () => {
      const ok = gameReducer(stateWith(), {
        type: "SET_NAME",
        value: "1234567890",
      });
      expect(ok.nameInputValue).toBe("1234567890");
      const tooLong = gameReducer(ok, {
        type: "SET_NAME",
        value: "12345678901",
      });
      expect(tooLong.nameInputValue).toBe("1234567890");
    });
  });
});
