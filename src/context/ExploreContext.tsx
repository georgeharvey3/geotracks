import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import {
  createInitialExploreState,
  exploreReducer,
  ExploreAction,
  ExploreState,
} from "../state/exploreReducer";
import useCommunityAlbumsHook from "../hooks/useCommunityAlbums";

interface ExploreContextValue {
  state: ExploreState;
  dispatch: React.Dispatch<ExploreAction>;
}

const ExploreContext = createContext<ExploreContextValue | null>(null);

/**
 * Explore's state, held above the screen so a country's place within its queue
 * survives a trip to the menu — the country being listened to does not; the
 * screen unchooses it on the way out. A sibling of GameProvider, not a child of
 * it: neither reads the other (ADR-0003).
 */
export function ExploreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(exploreReducer, undefined, () =>
    createInitialExploreState(),
  );

  // The live albums, read here as well as in GameProvider — the two providers
  // are siblings and neither reads the other (ADR-0003). It is one subscription
  // underneath: `onValue` on the same ref shares the connection, and the read is
  // the small half of the Library.
  const community = useCommunityAlbumsHook();
  const merged = useRef(false);
  useEffect(() => {
    if (community.status !== "ready" || merged.current) return;
    merged.current = true;
    dispatch({ type: "ALBUMS_LOADED", albums: community.albums });
  }, [community.status, community.albums]);

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
