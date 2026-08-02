import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import useDailyRun, { DAILY_RUN_STORAGE_KEY } from "./useDailyRun";
import { parseDailyRun, serializeDailyRun } from "../helpers/dailyRun";
import {
  createInitialState,
  dailyRunRecordFrom,
  gameReducer,
  GameState,
  NUM_COMPETITION_TURNS,
} from "../state/gameReducer";

// The clock is faked, not the storage: jsdom's localStorage is synchronous and
// well-behaved, and `vi.setSystemTime` moves the song seed with the day exactly
// as a real rollover does.
const AUGUST_1 = new Date(2026, 7, 1, 9, 0);
const AUGUST_2 = new Date(2026, 7, 2, 9, 0);

const stored = () => parseDailyRun(localStorage.getItem(DAILY_RUN_STORAGE_KEY));

function storeRun(state: GameState, day: string) {
  localStorage.setItem(
    DAILY_RUN_STORAGE_KEY,
    serializeDailyRun(dailyRunRecordFrom(state, day)!),
  );
}

/** A Competition Run part-way through its second turn. */
function runInProgress(): GameState {
  const state = gameReducer(createInitialState(), { type: "START_RUN" });
  return { ...state, turnIndex: 1, score: 150, dailySongIndex: 2 };
}

beforeEach(() => {
  localStorage.clear();
  // Only Date: faking every timer would take React's scheduler with it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AUGUST_1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDailyRun", () => {
  it("has no day to report when nothing is stored", () => {
    const { result } = renderHook(() => useDailyRun(createInitialState()));
    expect(result.current.status).toBe("none");
    expect(result.current.record).toBeNull();
  });

  it("reads today's Run on mount", () => {
    storeRun(runInProgress(), "2026-08-01");

    const { result } = renderHook(() => useDailyRun(createInitialState()));
    expect(result.current.status).toBe("in-progress");
    expect(result.current.record!.turnIndex).toBe(1);
  });

  // Any date mismatch unlocks, including a stored date in the future: a clock
  // that was briefly wrong must not brick the mode.
  it("ignores a record from another day, past or future", () => {
    storeRun(runInProgress(), "2026-07-31");
    expect(
      renderHook(() => useDailyRun(createInitialState())).result.current.status,
    ).toBe("none");

    storeRun(runInProgress(), "2027-01-01");
    expect(
      renderHook(() => useDailyRun(createInitialState())).result.current.status,
    ).toBe("none");
  });

  it("spends the day the moment a Run starts, before a single guess", () => {
    const { rerender } = renderHook(({ state }) => useDailyRun(state), {
      initialProps: { state: createInitialState() },
    });
    expect(stored()).toBeNull();

    act(() => {
      rerender({
        state: gameReducer(createInitialState(), { type: "START_RUN" }),
      });
    });

    expect(stored()!.status).toBe("in-progress");
    expect(stored()!.date).toBe("2026-08-01");
  });

  it("keeps the record level with the Run as it is played", () => {
    const started = gameReducer(createInitialState(), { type: "START_RUN" });
    const { result, rerender } = renderHook(({ state }) => useDailyRun(state), {
      initialProps: { state: started },
    });

    const guessed = gameReducer(started, {
      type: "SUBMIT_GUESS",
      countryAnswer: started.song.country,
    });
    act(() => rerender({ state: guessed }));

    expect(stored()!.score).toBe(150);
    expect(stored()!.round.correct).toBe(true);
    // What the menu will read on the next visit, without a second storage read.
    expect(result.current.record!.score).toBe(150);
  });

  it("records the Run as finished once it is out of turns", () => {
    const state = { ...runInProgress(), turnIndex: NUM_COMPETITION_TURNS };
    renderHook(() => useDailyRun(state));
    expect(stored()!.status).toBe("finished");
  });

  // The day survives the walk back to the menu — that is the whole point of it.
  it("leaves the stored day alone when the player is not on a Run", () => {
    const started = gameReducer(createInitialState(), { type: "START_RUN" });
    const { rerender } = renderHook(({ state }) => useDailyRun(state), {
      initialProps: { state: started },
    });
    expect(stored()).not.toBeNull();

    act(() => {
      rerender({ state: gameReducer(started, { type: "RESET_TO_MENU" }) });
    });

    expect(stored()!.status).toBe("in-progress");
  });

  it("hands back the day at the next midnight", () => {
    storeRun(runInProgress(), "2026-08-01");
    expect(
      renderHook(() => useDailyRun(createInitialState())).result.current.status,
    ).toBe("in-progress");

    vi.setSystemTime(AUGUST_2);
    expect(
      renderHook(() => useDailyRun(createInitialState())).result.current.status,
    ).toBe("none");
  });

  // Fail open: private-mode storage that throws, or a record we wrote wrong,
  // costs the player nothing.
  it("gives the player a fresh Run when the record will not parse", () => {
    localStorage.setItem(DAILY_RUN_STORAGE_KEY, "{not json");
    expect(
      renderHook(() => useDailyRun(createInitialState())).result.current.status,
    ).toBe("none");
  });

  it("survives storage that refuses to be read or written", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    const started = gameReducer(createInitialState(), { type: "START_RUN" });
    const { result } = renderHook(() => useDailyRun(started));
    expect(result.current.status).toBe("in-progress");

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
