import { Box } from "@mui/material";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS } from "../../map/fills";

// How much of the map survives the wash. The map is composited over the page's
// cream at this opacity rather than dimmed toward black: the menu is ink on
// paper, so anything that darkened the ground would take the wordmark and the
// outlined button down with it. At 0.35 the sea lands on a pale blue that still
// carries ink at ~11:1, and the coastline is all that is left of the world.
const BACKDROP_OPACITY = 0.35;

/**
 * The world map as the menu's backdrop: the game's map at rest, washed back
 * into the paper and inert.
 *
 * It is decoration, and the only surface here that is. Nothing may be picked
 * (`selectable` is false everywhere and no country is named on hover), and the
 * whole thing is click-through and hidden from the accessibility tree, so the
 * menu's own buttons remain the entire screen as far as a pointer, a keyboard
 * or a screen reader is concerned.
 */
const MenuMap = () => (
  <Box
    aria-hidden
    data-testid="menu-backdrop"
    sx={{
      position: "fixed",
      inset: 0,
      // Behind the menu column, and untouchable: the map keeps no gesture, so
      // pan/zoom never fires and the buttons over it take every click.
      zIndex: 0,
      pointerEvents: "none",
      opacity: BACKDROP_OPACITY,
    }}
  >
    <BaseMap
      // The game's resting fills, unchanged: land everywhere the app has a
      // country, inert grey for the shapes it doesn't.
      fillFor={(code) =>
        code === undefined ? MAP_FILLS.inertLand : MAP_FILLS.land
      }
      // The ground under the menu, so it covers in portrait too: there is no
      // tray to leave the world room beside, and no chrome to sit below.
      cover
      selectable={() => false}
      labelFor={() => undefined}
      armOnTouch={false}
      onCommit={() => {}}
    />
  </Box>
);

export default MenuMap;
