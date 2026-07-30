import { useEffect, useRef } from "react";
import { Box } from "@mui/material";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS } from "../../map/fills";
import { COLORS } from "../../tokens";

/**
 * Whether a backdrop has stood under a page yet in this session.
 *
 * It is how the backdrop tells its two arrivals apart. It mounts in exactly two
 * situations: on first load, and on the return from a map surface — between the
 * two content pages it never leaves, because it is rendered outside the column
 * that changes. So the first mount of a session is the one that must not
 * animate: there is nothing to come back from, and drawing the night on would
 * mean showing the player a lit world and then putting it out.
 */
let hasStoodUnderAPage = false;

/**
 * The world map as the ground under a content page: the map at rest under a
 * black veil, inert.
 *
 * It is decoration, and the only surface here that is. Nothing may be picked
 * (`selectable` is false everywhere and no country is named on hover), the
 * straggler dots are off — they are targets, and nothing here is a target — and
 * the whole thing is click-through and hidden from the accessibility tree, so
 * the page's own buttons remain the entire screen as far as a pointer, a
 * keyboard or a screen reader is concerned.
 */
const BackdropMap = () => {
  // Read once and held for the life of the mount: the page standing on this
  // re-renders for its own reasons, and none of them may restart the night
  // coming in or cut it short.
  const returning = useRef(hasStoodUnderAPage).current;
  useEffect(() => {
    hasStoodUnderAPage = true;
  }, []);

  return (
    <Box
      aria-hidden
      data-testid="page-backdrop"
      sx={{
        position: "fixed",
        inset: 0,
        // Behind the page's column, and untouchable: the map keeps no gesture,
        // so pan/zoom never fires and the buttons over it take every click.
        zIndex: 0,
        pointerEvents: "none",
        // The veil's own black underneath as well, so nothing cream can show
        // around the map whatever the shape of the viewport.
        bgcolor: COLORS.night,
      }}
    >
      <BaseMap
        // One fill for every shape, playable or not. The game's land/inert split
        // is a statement about where there is music, and under the veil the two
        // land a hundredth of a stop apart anyway — all it would add here is
        // patchiness in a picture that means nothing.
        fillFor={() => MAP_FILLS.land}
        // The ground under a page, so it covers in portrait too: there is no
        // tray to leave the world room beside, and no chrome to sit below.
        cover
        showStragglers={false}
        // The map at rest in the dark — arrived at, on the way back from a map
        // surface, by the night being drawn over the world the player was just
        // looking at. It is the same veil a map surface lifts on the way in,
        // which is why it belongs to the map rather than to this component:
        // both directions have to start and end on the same darkness.
        veil={returning ? "settle" : "night"}
        selectable={() => false}
        labelFor={() => undefined}
        armOnTouch={false}
        onCommit={() => {}}
      />
    </Box>
  );
};

export default BackdropMap;
