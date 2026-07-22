import React, { createContext, useContext, useReducer } from "react";
import {
  gameReducer,
  createInitialState,
  GameState,
  GameAction,
} from "../state/gameReducer";
import useLeaderboardHook, { Leaderboard } from "../hooks/useLeaderboard";

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  leaderboard: Leaderboard;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState()
  );
  const leaderboard = useLeaderboardHook();

  return (
    <GameContext.Provider value={{ state, dispatch, leaderboard }}>
      {children}
    </GameContext.Provider>
  );
}

function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame/useLeaderboard must be used within a GameProvider");
  }
  return ctx;
}

// Game state + dispatch seam for presentational components.
export function useGame(): { state: GameState; dispatch: React.Dispatch<GameAction> } {
  const { state, dispatch } = useGameContext();
  return { state, dispatch };
}

// Leaderboard seam, read from context so the data hook runs once at the provider.
export function useLeaderboard(): Leaderboard {
  return useGameContext().leaderboard;
}
