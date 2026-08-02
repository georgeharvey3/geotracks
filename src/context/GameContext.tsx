import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import {
  gameReducer,
  createInitialState,
  GameState,
  GameAction,
} from "../state/gameReducer";
import useLeaderboardHook, { Leaderboard } from "../hooks/useLeaderboard";
import useDailyRunHook, { DailyRun } from "../hooks/useDailyRun";
import useCommunityAlbumsHook, {
  LibraryStatus,
} from "../hooks/useCommunityAlbums";
import { dayString } from "../helpers/dailyRun";

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  leaderboard: Leaderboard;
  dailyRun: DailyRun;
  /** Whether the live half of the Library has arrived. Competition waits on it. */
  libraryStatus: LibraryStatus;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(),
  );
  const leaderboard = useLeaderboardHook();
  // The Daily Run's storage seam, beside the leaderboard's network one: the
  // reducer stays pure and the day is read and written here.
  const dailyRun = useDailyRunHook(state);

  // The live half of the Library. The app renders on the bundled half at once
  // and this tops the pools up when it lands; Competition is what waits for it.
  const community = useCommunityAlbumsHook();

  // Dispatched **once**, on the first read to land. The pool a session plays is
  // the one it started with — already true of the bundled half — and an album
  // accepted while somebody is mid-session waits for their next load rather
  // than appearing in a pool they have been drawing from.
  const merged = useRef(false);
  useEffect(() => {
    if (community.status !== "ready" || merged.current) return;
    merged.current = true;
    dispatch({
      type: "ALBUMS_LOADED",
      albums: community.albums,
      today: dayString(new Date()),
    });
  }, [community.status, community.albums]);

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        leaderboard,
        dailyRun,
        libraryStatus: community.status,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error(
      "useGame/useLeaderboard/useDailyRun must be used within a GameProvider",
    );
  }
  return ctx;
}

// Game state + dispatch seam for presentational components.
export function useGame(): {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
} {
  const { state, dispatch } = useGameContext();
  return { state, dispatch };
}

// Leaderboard seam, read from context so the data hook runs once at the provider.
export function useLeaderboard(): Leaderboard {
  return useGameContext().leaderboard;
}

// The day's Competition Run, same arrangement: one storage seam at the provider.
export function useDailyRun(): DailyRun {
  return useGameContext().dailyRun;
}

// Whether the live albums have arrived. The menu reads this to decide whether
// Competition may be started at all (ADR-0007).
export function useLibraryStatus(): LibraryStatus {
  return useGameContext().libraryStatus;
}
