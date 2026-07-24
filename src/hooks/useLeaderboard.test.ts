import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Firebase Database SDK surface the hook uses.
const dbMocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  push: vi.fn((_ref: unknown, _value: unknown) =>
    Promise.resolve({ key: "-newId" }),
  ),
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  orderByChild: vi.fn((child: string) => ({ orderByChild: child })),
  limitToLast: vi.fn((n: number) => ({ limitToLast: n })),
  serverTimestamp: vi.fn(() => ({ ".sv": "timestamp" })),
}));

vi.mock("firebase/database", () => dbMocks);

const ensureAnonymousAuth = vi.fn(() => Promise.resolve());
vi.mock("../firebase", () => ({
  db: {},
  ensureAnonymousAuth: () => ensureAnonymousAuth(),
}));

import useLeaderboard from "./useLeaderboard";

type ScoreRecord = [string, { name: string; score: number; createdAt: number }];

// Fake RTDB snapshot whose forEach yields children with `.key` and `.val()`.
function makeSnapshot(records: ScoreRecord[]) {
  return {
    forEach(cb: (child: { key: string; val: () => unknown }) => void) {
      records.forEach(([key, value]) => cb({ key, val: () => value }));
    },
  };
}

describe("useLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.push.mockResolvedValue({ key: "-newId" });
    ensureAnonymousAuth.mockResolvedValue(undefined);
  });

  it("reads scores ordered by score and bounded to 20, exposed high-to-low", async () => {
    dbMocks.onValue.mockImplementation(
      (
        _query: unknown,
        cb: (snap: ReturnType<typeof makeSnapshot>) => void,
      ) => {
        cb(
          makeSnapshot([
            ["-a", { name: "Bob", score: 950, createdAt: 1 }],
            ["-b", { name: "Alice", score: 1200, createdAt: 2 }],
          ]),
        );
        return () => {};
      },
    );

    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => expect(result.current.scores).toHaveLength(2));

    expect(dbMocks.orderByChild).toHaveBeenCalledWith("score");
    expect(dbMocks.limitToLast).toHaveBeenCalledWith(20);
    // Sorted high-to-low, keyed by push ID.
    expect(result.current.scores[0]).toEqual({
      id: "-b",
      name: "Alice",
      score: 1200,
      createdAt: 2,
    });
    expect(result.current.scores[1]!.id).toBe("-a");
  });

  it("subscribes to public reads without requiring anonymous auth", () => {
    dbMocks.onValue.mockReturnValue(() => {});
    renderHook(() => useLeaderboard());

    // Reads are public; the leaderboard must render even if sign-in is
    // unavailable. Auth is only exercised on submit.
    expect(dbMocks.onValue).toHaveBeenCalledTimes(1);
    expect(ensureAnonymousAuth).not.toHaveBeenCalled();
  });

  it("submits a score as an append-only push record with a server timestamp", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload },
      writable: true,
    });
    dbMocks.onValue.mockReturnValue(() => {});

    const { result } = renderHook(() => useLeaderboard());

    await act(async () => {
      await result.current.submitScore("Zoe", 300);
    });

    expect(ensureAnonymousAuth).toHaveBeenCalled();
    expect(dbMocks.push).toHaveBeenCalledTimes(1);
    const payload = dbMocks.push.mock.calls[0]![1];
    expect(payload).toEqual({
      name: "Zoe",
      score: 300,
      createdAt: { ".sv": "timestamp" },
    });
    expect(reload).toHaveBeenCalled();
  });
});
