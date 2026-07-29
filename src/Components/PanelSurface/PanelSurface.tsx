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
      borderRadius: "16px 16px 0 0",
      borderTop: "1px solid",
      borderColor: "divider",
      bgcolor: "rgba(22, 33, 62, 0.92)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)",

      [LANDSCAPE_MEDIA]: {
        position: "absolute",
        flex: "none",
        top: 72,
        right: 24,
        width: 380,
        maxHeight: "calc(100vh - 96px)",
        pb: 1.5,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      },
    }}
  >
    {children}
  </Box>
);

export default PanelSurface;
