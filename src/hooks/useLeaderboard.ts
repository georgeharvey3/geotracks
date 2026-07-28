import { useCallback, useEffect, useState } from "react";
import {
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
} from "firebase/database";
import { ScoreEntry } from "../types";
import { db, ensureAnonymousAuth } from "../firebase";

// Highest scores shown on the leaderboard. Reads are bounded to this many
// records server-side (`limitToLast`), so the client never downloads the full
// history.
const MAX_LEADERBOARD_ENTRIES = 20;

export interface Leaderboard {
  // Scores sorted high-to-low.
  scores: ScoreEntry[];
  // Persist a score and refresh the app (behaviour preserved from before).
  submitScore: (name: string, score: number) => Promise<void>;
}

/**
 * Leaderboard reads/writes behind a stable surface. Backed by the Firebase JS
 * SDK with anonymous auth: scores live in `scores/{pushId}: { name, score,
 * createdAt }` as an append-only list, read back ordered + bounded and written
 * with `push()`. Consumers are unaffected by this implementation.
 */
export default function useLeaderboard(): Leaderboard {
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    // Reads are public under the RTDB rules, so subscribe immediately without
    // waiting for auth. This keeps the leaderboard visible to players even if
    // anonymous sign-in is unavailable (auth is only needed to *submit*).
    const scoresQuery = query(
      ref(db, "scores"),
      orderByChild("score"),
      limitToLast(MAX_LEADERBOARD_ENTRIES),
    );

    const unsubscribe = onValue(scoresQuery, (snapshot) => {
      const entries: ScoreEntry[] = [];
      snapshot.forEach((child) => {
        const value = child.val() ?? {};
        entries.push({
          id: child.key ?? undefined,
          name: value.name,
          score: value.score,
          createdAt: value.createdAt,
        });
      });
      // RTDB returns `orderByChild` results ascending; present high-to-low.
      entries.sort((a, b) => b.score - a.score);
      setScores(entries);
    });

    return () => unsubscribe();
  }, []);

  const submitScore = useCallback(async (name: string, score: number) => {
    await ensureAnonymousAuth();

    await push(ref(db, "scores"), {
      name,
      score,
      createdAt: serverTimestamp(),
    });

    window.location.reload();
  }, []);

  return { scores, submitScore };
}
