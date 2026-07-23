import { useCallback, useEffect, useState } from "react";
import { ScoreEntry } from "../types";
import { SCORES_URL } from "../config";

export interface Leaderboard {
  // Scores sorted high-to-low.
  scores: ScoreEntry[];
  // Persist a score and refresh the app (behaviour preserved from before).
  submitScore: (name: string, score: number) => Promise<void>;
}

async function fetchScores(): Promise<ScoreEntry[]> {
  const res = await fetch(SCORES_URL);
  const json = await res.json();

  const scoresArray: ScoreEntry[] = Object.entries(json ?? {}).map((entry) => ({
    name: entry[0],
    score: entry[1] as number,
  }));

  return scoresArray.sort((a, b) => b.score - a.score);
}

/**
 * Leaderboard reads/writes behind a stable surface. The current implementation
 * is the raw name-keyed RTDB fetch; the Firebase SDK + auth + rules hardening
 * lands entirely behind this hook without touching consumers.
 */
export default function useLeaderboard(): Leaderboard {
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    fetchScores().then(setScores);
  }, []);

  const submitScore = useCallback(async (name: string, score: number) => {
    const scoresRes = await fetch(SCORES_URL);
    const scoresJson = await scoresRes.json();

    await fetch(SCORES_URL, {
      method: "PUT",
      body: JSON.stringify({ ...scoresJson, [name]: score }),
    });

    window.location.reload();
  }, []);

  return { scores, submitScore };
}
