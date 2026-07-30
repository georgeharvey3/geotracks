import React, { createContext, useContext, useReducer } from "react";
import {
  createInitialExploreState,
  exploreReducer,
  ExploreAction,
  ExploreState,
} from "../state/exploreReducer";

interface ExploreContextValue {
  state: ExploreState;
  dispatch: React.Dispatch<ExploreAction>;
}

const ExploreContext = createContext<ExploreContextValue | null>(null);

/**
 * Explore's state, held above the screen so a trip to the menu and back keeps
 * the player's country and their place within it. A sibling of GameProvider,
 * not a child of it: neither reads the other (ADR-0003).
 */
export function ExploreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(exploreReducer, undefined, () =>
    createInitialExploreState(),
  );

  return (
    <ExploreContext.Provider value={{ state, dispatch }}>
      {children}
    </ExploreContext.Provider>
  );
}

export function useExplore(): ExploreContextValue {
  const ctx = useContext(ExploreContext);
  if (!ctx) {
    throw new Error("useExplore must be used within an ExploreProvider");
  }
  return ctx;
}
