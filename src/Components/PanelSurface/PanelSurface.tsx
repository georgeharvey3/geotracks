import { ReactNode } from "react";
import { Box } from "@mui/material";

import { LANDSCAPE_MEDIA, PORTRAIT_PANEL_MAX_HEIGHT } from "../../layout";

/**
 * The surface every control panel sits on, shared so the game's panel and
 * Explore's read as one app.
 *
 * Portrait: a tray in normal flow, no taller than its own content — the map
 * gets everything it doesn't claim.
 * Landscape: a card floating over the top-right of the map, deliberately
 * occluding it — the map pans and zooms underneath, and the panel is the one
 * thing the player needs pinned in place.
 */
const PanelSurface = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      position: "relative",
      zIndex: 3,
      // Sized to content, capped so the panel can never squeeze the map out;
      // past the cap the tray scrolls on its own.
      flex: "0 1 auto",
      minHeight: 0,
      maxHeight: PORTRAIT_PANEL_MAX_HEIGHT,
      overflowY: "auto",
      // The map claims every touch gesture for pan/zoom; the panel needs its
      // own back so its content can be scrolled.
      touchAction: "auto",
      textAlign: "center",
      px: 2,
      pt: 1.5,
      pb: "calc(12px + env(safe-area-inset-bottom))",
      borderRadius: "20px 20px 0 0",
      // Opaque, and outlined rather than blurred. A translucent blur over a map
      // fights the thing it sits on: the panel is the one surface that has to
      // stay readable whatever the player has panned underneath it.
      borderTop: "1.5px solid",
      borderColor: "text.primary",
      bgcolor: "background.paper",
      boxShadow: "0 -10px 30px -18px rgba(18, 23, 27, 0.45)",
      // Placed on the map rather than appearing with it: the panel comes in
      // from the edge it is attached to, a beat after the screen it lands on.
      // The keyframes are in `index.css`; which one to use is a question about
      // where the panel sits, so it is asked here where the geometry is.
      animation: "panel-enter 320ms var(--ease-snap) 120ms both",

      [LANDSCAPE_MEDIA]: {
        animation: "panel-enter-landscape 320ms var(--ease-snap) 120ms both",
        position: "absolute",
        flex: "none",
        top: 72,
        right: 24,
        width: 380,
        maxHeight: "calc(100vh - 96px)",
        pb: 1.5,
        borderRadius: "20px",
        border: "1.5px solid",
        borderColor: "text.primary",
        boxShadow: "0 16px 34px -20px rgba(18, 23, 27, 0.45)",
      },
    }}
  >
    {children}
  </Box>
);

export default PanelSurface;
