import { Box } from "@mui/material";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS } from "../../map/fills";
import { COLORS } from "../../tokens";

// How much black lies over the map. This is a veil rather than a wash: the map
// is drawn at full strength and then almost entirely covered, so what is left
// is a coastline in the dark rather than a picture of the world. High enough
// that the page reads as one black ground — paper text lands at ~12:1 over it,
// whatever the map has drawn underneath — and low enough that the land/sea step
// still shows as a ghost of an edge.
const VEIL_OPACITY = 0.82;

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
const BackdropMap = () => (
  <Box
    aria-hidden
    data-testid="page-backdrop"
    sx={{
      position: "fixed",
      inset: 0,
      // Behind the page's column, and untouchable: the map keeps no gesture, so
      // pan/zoom never fires and the buttons over it take every click.
      zIndex: 0,
      pointerEvents: "none",
      // The veil's own black underneath as well, so nothing cream can flash
      // through before the map's ~250 shapes are drawn.
      bgcolor: COLORS.night,
    }}
  >
    <BaseMap
      // One fill for every shape, playable or not. The game's land/inert split
      // is a statement about where there is music, and under the veil the two
      // land a hundredth of a stop apart anyway — all it would add here is
      // patchiness in a picture that means nothing.
      fillFor={() => MAP_FILLS.land}
      // The ground under a page, so it covers in portrait too: there is no tray
      // to leave the world room beside, and no chrome to sit below.
      cover
      showStragglers={false}
      selectable={() => false}
      labelFor={() => undefined}
      armOnTouch={false}
      onCommit={() => {}}
    />
    <Box
      data-testid="page-backdrop-veil"
      sx={{
        position: "absolute",
        inset: 0,
        bgcolor: COLORS.night,
        opacity: VEIL_OPACITY,
      }}
    />
  </Box>
);

export default BackdropMap;
