import { useMediaQuery } from "@mui/material";

// A hovering, precise pointer (mouse, trackpad) can preview a country before
// committing it, so the map lets a single click commit. Without one (touch),
// the map falls back to tap-to-arm then tap-to-commit.
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

/** Whether the device driving the app has a hovering pointer. */
function useHasHover(): boolean {
  return useMediaQuery(HOVER_QUERY, { defaultMatches: true });
}

export default useHasHover;
