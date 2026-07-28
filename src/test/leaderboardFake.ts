import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { Leaderboard } from "../hooks/useLeaderboard";
import type { ScoreEntry } from "../types";

/**
 * Stateful, implementation-agnostic fake for the `useLeaderboard` seam. It holds
 * scores in memory and exposes `submitScore` as a spy, so the integration suite
 * never touches Firebase, the network, or `window.location.reload`. Tests seed
 * scores via `setScores` before rendering the scoreboard.
 */

let scores: ScoreEntry[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ScoreEntry[] {
  return scores;
}

const submitScore = vi.fn(async (_name: string, _score: number) => {});

export const leaderboardControl = {
  setScores: (next: ScoreEntry[]) => {
    scores = next;
    notify();
  },
  submitScore,
  reset: () => {
    scores = [];
    submitScore.mockClear();
    notify();
  },
};

// Mock implementation swapped in for the default export of useLeaderboard.
export default function useLeaderboardFake(): Leaderboard {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return { scores: snap, submitScore };
}
