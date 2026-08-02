import {
  gameReducer,
  createInitialState,
  dailyRunRecordFrom,
  GameState,
  GAME_MODES,
  NUM_COMPETITION_TURNS,
  MAX_COMPETITION_SCORE,
} from "./gameReducer";
import { parseDailyRun, serializeDailyRun } from "../helpers/dailyRun";
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

    it("NEXT_SONG reaches the Run summary on the last competition turn", () => {
      const state = stateWith({
        finished: true,
        turnIndex: NUM_COMPETITION_TURNS - 1,
      });
      const next = gameReducer(state, { type: "NEXT_SONG" });
      expect(next.screen).toBe("runSummary");
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

  describe("the displayed Song's metadata", () => {
    it("SET_SONG_METADATA lands on the song it was fetched for", () => {
      const next = gameReducer(stateWith(), {
        type: "SET_SONG_METADATA",
        link: FRANCE_SONG.link,
        metadata: {
          trackTitle: "Non, je ne regrette rien",
          artistName: "Édith Piaf",
          thumbnailUrl: "https://i.scdn.co/image/abc",
        },
      });
      expect(next.song.trackTitle).toBe("Non, je ne regrette rien");
      expect(next.song.artistName).toBe("Édith Piaf");
      expect(next.song.thumbnailUrl).toBe("https://i.scdn.co/image/abc");
      // The rest of the Song is untouched.
      expect(next.song.country).toBe("France");
      expect(next.song.link).toBe(FRANCE_SONG.link);
    });

    it("ignores metadata fetched for a song that is no longer playing", () => {
      const state = stateWith();
      const next = gameReducer(state, {
        type: "SET_SONG_METADATA",
        link: "https://open.spotify.com/track/stale",
        metadata: { trackTitle: "The Previous Song" },
      });
      expect(next).toBe(state);
    });
  });

  describe("Run summary", () => {
    // A Turn result is snapshotted when the turn is retired, so drive each turn
    // the way the game does: guess, then NEXT_SONG.
    function playTurn(
      state: GameState,
      guesses: string[],
      geoHints = false,
    ): GameState {
      let next = geoHints
        ? gameReducer(state, { type: "TOGGLE_GEO_HINTS", checked: true })
        : state;
      for (const country of guesses) {
        next = gameReducer(next, {
          type: "SUBMIT_GUESS",
          countryAnswer: country,
        });
      }
      return gameReducer(next, { type: "NEXT_SONG" });
    }

    it("keeps a first-attempt answer with its attempts and points", () => {
      const next = playTurn(stateWith(), ["France"]);
      expect(next.turns).toHaveLength(1);
      expect(next.turns[0]).toMatchObject({
        outcome: "named-first",
        attempts: 1,
        points: 150,
        geoHintsUsed: false,
      });
      expect(next.turns[0]!.song.link).toBe(FRANCE_SONG.link);
    });

    it("keeps a later-attempt answer with the attempts it took", () => {
      const next = playTurn(stateWith(), ["Japan", "Spain", "France"]);
      expect(next.turns[0]).toMatchObject({
        outcome: "named-later",
        attempts: 3,
        points: 60,
      });
    });

    it("keeps a missed turn with no points", () => {
      const next = playTurn(stateWith(), [
        "Japan",
        "Spain",
        "Italy",
        "Brazil",
        "Chile",
      ]);
      expect(next.turns[0]).toMatchObject({
        outcome: "missed",
        attempts: 5,
        points: 0,
      });
    });

    it("marks a turn played with geo-hints on, and halves its points", () => {
      const next = playTurn(stateWith(), ["France"], true);
      expect(next.turns[0]).toMatchObject({
        geoHintsUsed: true,
        points: 75,
      });
    });

    it("keeps the metadata the Song was heard with", () => {
      const withMetadata = gameReducer(stateWith(), {
        type: "SET_SONG_METADATA",
        link: FRANCE_SONG.link,
        metadata: { trackTitle: "La Vie en rose" },
      });
      const next = playTurn(withMetadata, ["France"]);
      expect(next.turns[0]!.song.trackTitle).toBe("La Vie en rose");
    });

    it("accumulates one Turn result per turn of the Run", () => {
      let state = stateWith();
      for (let turn = 0; turn < NUM_COMPETITION_TURNS; turn += 1) {
        state = playTurn({ ...state, song: FRANCE_SONG }, ["France"]);
      }
      expect(state.turns).toHaveLength(NUM_COMPETITION_TURNS);
      expect(state.screen).toBe("runSummary");
    });

    it("keeps nothing in Infinite, which has no Run to summarise", () => {
      const state = stateWith({ gameMode: GAME_MODES.infinite });
      const next = playTurn(state, ["France"]);
      expect(next.turns).toHaveLength(0);
    });

    it("SCORE_SUBMITTED records the Run's one leaderboard write", () => {
      const next = gameReducer(stateWith(), { type: "SCORE_SUBMITTED" });
      expect(next.scoreSubmitted).toBe(true);
    });

    it("RESET_TO_MENU discards the Run", () => {
      const played = playTurn(stateWith(), ["France"]);
      const submitted = gameReducer(played, { type: "SCORE_SUBMITTED" });
      const next = gameReducer(submitted, { type: "RESET_TO_MENU" });
      expect(next.turns).toHaveLength(0);
      expect(next.scoreSubmitted).toBe(false);
      expect(next.nameInputValue).toBe("");
    });
  });

  /**
   * The Daily Songs are Competition's (issue #49). Nothing may assert *which*
   * Songs a day yields — the seed moves with the date — so what is pinned here
   * is who draws from the list and who leaves it alone.
   */
  describe("the Daily Songs", () => {
    /** Answer the round correctly and retire the turn, whatever the Song is. */
    function playRound(state: GameState): GameState {
      const answered = gameReducer(state, {
        type: "SUBMIT_GUESS",
        countryAnswer: state.song.country,
      });
      return gameReducer(answered, { type: "NEXT_SONG" });
    }

    it("costs the day nothing to open the menu", () => {
      const initial = createInitialState();
      expect(initial.dailySongIndex).toBe(0);
      expect(initial.dailySongs).toHaveLength(NUM_COMPETITION_TURNS);
    });

    it("walks Competition through the day's ten, in order", () => {
      let state = gameReducer(createInitialState(), { type: "START_RUN" });
      const daily = state.dailySongs;

      for (let turn = 0; turn < NUM_COMPETITION_TURNS; turn += 1) {
        expect(state.song.link).toBe(daily[turn]!.link);
        state = playRound(state);
      }
      expect(state.screen).toBe("runSummary");
    });

    // The leak: an Infinite player used to be served today's Competition Songs,
    // and to walk the index on past them. `START_RUN`'s anchor kept the Run's
    // *contents* right through that (the list is never mutated), so what was
    // actually being handed out was the answers.
    it("is left where it stands however long Infinite plays", () => {
      let state = gameReducer(createInitialState(), {
        type: "SET_MODE",
        mode: GAME_MODES.infinite,
      });

      for (let round = 0; round < NUM_COMPETITION_TURNS + 2; round += 1) {
        state = playRound(state);
      }
      expect(state.dailySongIndex).toBe(0);
    });

    it("still has the whole day left for Competition after Infinite", () => {
      let state = gameReducer(createInitialState(), {
        type: "SET_MODE",
        mode: GAME_MODES.infinite,
      });
      for (let round = 0; round < NUM_COMPETITION_TURNS + 2; round += 1) {
        state = playRound(state);
      }

      state = gameReducer(state, { type: "START_RUN" });
      const daily = state.dailySongs;
      for (let turn = 0; turn < NUM_COMPETITION_TURNS; turn += 1) {
        expect(state.song.link).toBe(daily[turn]!.link);
        state = playRound(state);
      }
    });

    it("costs the day nothing to walk back to the menu", () => {
      const state = stateWith({ finished: true, dailySongIndex: 3 });
      const next = gameReducer(state, { type: "RESET_TO_MENU" });
      expect(next.dailySongIndex).toBe(3);
    });
  });

  // The Daily Run (issue #1, ADR-0004): the one Competition Run a browser
  // profile may play on a calendar day, spent on start and resumed where it
  // stood. The reducer stays pure — the day's record arrives on the action.
  describe("the Daily Run", () => {
    const DAY = "2026-08-01";

    it("START_RUN opens Competition on the first turn, with nothing carried in", () => {
      const stale = stateWith({
        screen: "menu",
        gameMode: "",
        score: 500,
        turnIndex: 4,
        turns: [
          {
            song: FRANCE_SONG,
            outcome: "missed",
            attempts: 5,
            points: 0,
            geoHintsUsed: false,
          },
        ],
        scoreSubmitted: true,
        nameInputValue: "Ada",
        guesses: [{ country: "Spain", correct: false }],
      });
      const next = gameReducer(stale, { type: "START_RUN" });

      expect(next.screen).toBe("playing");
      expect(next.gameMode).toBe(GAME_MODES.competition);
      expect(next.score).toBe(0);
      expect(next.turnIndex).toBe(0);
      expect(next.turns).toHaveLength(0);
      expect(next.scoreSubmitted).toBe(false);
      expect(next.nameInputValue).toBe("");
      expect(next.guesses).toHaveLength(0);
    });

    // The Run *is* the day's seeded ten, wherever the session left the index:
    // a Run that opened halfway down the list would not be the same Run
    // everyone else played. Nothing outside Competition moves the index any
    // more (issue #49), so this is now the belt to that braces.
    it("START_RUN opens on the day's first Song whatever the index says", () => {
      const initial = createInitialState();
      const played = { ...initial, dailySongIndex: 5 };
      const next = gameReducer(played, { type: "START_RUN" });

      expect(next.song.link).toBe(initial.dailySongs[0]!.link);
      expect(next.dailySongIndex).toBe(1);
    });

    it("RESUME_RUN drops the player back into the turn they left", () => {
      const initial = createInitialState();
      const inFlight = initial.dailySongs[3]!;
      const next = gameReducer(initial, {
        type: "RESUME_RUN",
        record: {
          v: 1,
          date: DAY,
          status: "in-progress",
          turnIndex: 3,
          score: 310,
          dailySongIndex: 4,
          scoreSubmitted: false,
          turns: [],
          round: {
            guesses: [
              {
                country: "Spain",
                correct: false,
                distance: 900,
                direction: "N",
              },
            ],
            geoHintsEnabled: true,
            finished: false,
            correct: false,
            roundPoints: 0,
          },
        },
      });

      expect(next.screen).toBe("playing");
      expect(next.gameMode).toBe(GAME_MODES.competition);
      expect(next.song.link).toBe(inFlight.link);
      expect(next.dailySongIndex).toBe(4);
      expect(next.turnIndex).toBe(3);
      expect(next.score).toBe(310);
    });

    // Restoring to a clean turn boundary would let two wrong guesses plus a
    // reload buy back a fresh 150-point first attempt.
    it("RESUME_RUN restores the round in flight, not just the turns behind it", () => {
      const initial = createInitialState();
      const next = gameReducer(initial, {
        type: "RESUME_RUN",
        record: {
          v: 1,
          date: DAY,
          status: "in-progress",
          turnIndex: 0,
          score: 0,
          dailySongIndex: 1,
          scoreSubmitted: false,
          turns: [],
          round: {
            guesses: [
              { country: "Spain", correct: false },
              { country: "Italy", correct: false },
            ],
            geoHintsEnabled: true,
            finished: false,
            correct: false,
            roundPoints: 0,
          },
        },
      });

      expect(next.guesses).toHaveLength(2);
      expect(next.submitted).toBe(true);
      expect(next.geoHintsEnabled).toBe(true);
      expect(next.showGeoHints).toBe(true);

      // And the next attempt is priced as the third, not the first.
      const named = gameReducer(next, {
        type: "SUBMIT_GUESS",
        countryAnswer: next.song.country,
      });
      expect(named.score).toBe(30);
    });

    it("RESUME_RUN restores a round that had already ended, answer revealed", () => {
      const initial = createInitialState();
      const next = gameReducer(initial, {
        type: "RESUME_RUN",
        record: {
          v: 1,
          date: DAY,
          status: "in-progress",
          turnIndex: 2,
          score: 200,
          dailySongIndex: 3,
          scoreSubmitted: false,
          turns: [],
          round: {
            guesses: Array.from({ length: 5 }, () => ({
              country: "Spain",
              correct: false,
            })),
            geoHintsEnabled: false,
            finished: true,
            correct: false,
            roundPoints: 0,
          },
        },
      });

      expect(next.finished).toBe(true);
      expect(next.correct).toBe(false);
      expect(next.errorMessage).toBe(`Answer was: ${next.song.country}`);
    });

    // Failing open: a record we cannot land a Song from is a bug of ours, and
    // the player should still get their Run rather than a dead button.
    it("RESUME_RUN starts the day fresh when the record points outside today's Songs", () => {
      const initial = createInitialState();
      const next = gameReducer(initial, {
        type: "RESUME_RUN",
        record: {
          v: 1,
          date: DAY,
          status: "in-progress",
          turnIndex: 40,
          score: 0,
          dailySongIndex: 41,
          scoreSubmitted: false,
          turns: [],
          round: {
            guesses: [],
            geoHintsEnabled: false,
            finished: false,
            correct: false,
            roundPoints: 0,
          },
        },
      });

      expect(next.screen).toBe("playing");
      expect(next.turnIndex).toBe(0);
      expect(next.song.link).toBe(initial.dailySongs[0]!.link);
    });

    it("SHOW_RUN_SUMMARY reopens the finished Run, and remembers the score was saved", () => {
      const turn = {
        song: FRANCE_SONG,
        outcome: "named-first" as const,
        attempts: 1,
        points: 150,
        geoHintsUsed: false,
      };
      const next = gameReducer(createInitialState(), {
        type: "SHOW_RUN_SUMMARY",
        record: {
          v: 1,
          date: DAY,
          status: "finished",
          turnIndex: NUM_COMPETITION_TURNS,
          score: 1500,
          dailySongIndex: NUM_COMPETITION_TURNS,
          scoreSubmitted: true,
          turns: Array.from({ length: NUM_COMPETITION_TURNS }, () => turn),
          round: {
            guesses: [],
            geoHintsEnabled: false,
            finished: true,
            correct: true,
            roundPoints: 150,
          },
        },
      });

      expect(next.screen).toBe("runSummary");
      expect(next.gameMode).toBe(GAME_MODES.competition);
      expect(next.score).toBe(1500);
      expect(next.turns).toHaveLength(NUM_COMPETITION_TURNS);
      expect(next.scoreSubmitted).toBe(true);
    });

    it("SHOW_RUN_SUMMARY leaves the name box open on a Run whose score never went in", () => {
      const next = gameReducer(createInitialState(), {
        type: "SHOW_RUN_SUMMARY",
        record: {
          v: 1,
          date: DAY,
          status: "finished",
          turnIndex: NUM_COMPETITION_TURNS,
          score: 640,
          dailySongIndex: NUM_COMPETITION_TURNS,
          scoreSubmitted: false,
          turns: [],
          round: {
            guesses: [],
            geoHintsEnabled: false,
            finished: true,
            correct: true,
            roundPoints: 0,
          },
        },
      });

      expect(next.scoreSubmitted).toBe(false);
      expect(next.nameInputValue).toBe("");
    });
  });

  describe("dailyRunRecordFrom", () => {
    const DAY = "2026-08-01";

    it("keeps no day for a player who is not on a Competition Run", () => {
      expect(dailyRunRecordFrom(createInitialState(), DAY)).toBeNull();
      expect(
        dailyRunRecordFrom(stateWith({ gameMode: GAME_MODES.infinite }), DAY),
      ).toBeNull();
    });

    it("records a Run in progress, round in flight and all", () => {
      const state = stateWith({
        turnIndex: 2,
        score: 230,
        dailySongIndex: 3,
        guesses: [{ country: "Spain", correct: false }],
        geoHintsEnabled: true,
      });
      const record = dailyRunRecordFrom(state, DAY)!;

      expect(record).toMatchObject({
        v: 1,
        date: DAY,
        status: "in-progress",
        turnIndex: 2,
        score: 230,
        dailySongIndex: 3,
        scoreSubmitted: false,
      });
      expect(record.round.guesses).toHaveLength(1);
      expect(record.round.geoHintsEnabled).toBe(true);
    });

    // The status is the Run's own turn count, not the screen: the record has to
    // read "finished" long after the player has walked back to the menu.
    it("records a Run that has run out of turns as finished", () => {
      const state = stateWith({
        screen: "menu",
        turnIndex: NUM_COMPETITION_TURNS,
        score: MAX_COMPETITION_SCORE,
      });
      expect(dailyRunRecordFrom(state, DAY)!.status).toBe("finished");
    });

    it("round-trips through storage back into a resumable Run", () => {
      const state = stateWith({ turnIndex: 1, score: 150, dailySongIndex: 2 });
      const record = parseDailyRun(
        serializeDailyRun(dailyRunRecordFrom(state, DAY)!),
      );
      expect(record).not.toBeNull();
      expect(record!.turnIndex).toBe(1);
    });
  });
});
