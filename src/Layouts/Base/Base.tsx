import React from "react";
import { Box, Container, IconButton, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";

interface BaseProps {
  showMenuButton: boolean;
  onMenuClicked: () => void;
  /**
   * Game-screen layout: the content owns the whole viewport (the map is the
   * surface) and the title/home button become chrome floating above it, rather
   * than sitting in a centred column that scrolls.
   */
  fullBleed?: boolean;
  /**
   * Decoration drawn behind the centred column, covering the viewport. The
   * content page stays a column of type on paper — this is the ground it sits
   * on, so it must be click-through and hidden from the accessibility tree.
   * Ignored in `fullBleed`, where the content already is the surface.
   */
  backdrop?: React.ReactNode;
  children: React.ReactNode;
}

// The wordmark carries its emphasis in one coral letter rather than a gradient
// across the whole word: gradient text can't be selected, ignores the user's
// contrast settings, and is the most-copied generated-UI flourish there is.
const Wordmark = ({ fontSize }: { fontSize?: string }) => (
  <Typography
    variant="h1"
    // Splitting the word into elements to colour one letter also splits it for
    // the accessibility tree, which announces "Geo T racks". The label puts the
    // word back together: how it is read shouldn't follow how it is painted.
    aria-label="GeoTracks"
    sx={{ fontSize, py: fontSize ? 0 : 1 }}
  >
    Geo
    <Box component="span" sx={{ color: "error.main" }}>
      T
    </Box>
    racks
  </Typography>
);

const HomeButton = ({ onClick }: { onClick: () => void }) => (
  <IconButton
    onClick={onClick}
    aria-label="Back to menu"
    sx={{
      color: "text.secondary",
      "&:hover": { color: "text.primary" },
    }}
  >
    <HomeIcon />
  </IconButton>
);

/**
 * Chrome for the full-bleed layout. The row itself is click-through so the map
 * underneath stays draggable; only the button takes pointer events. A scrim
 * keeps the wordmark legible over whatever the map draws beneath it.
 */
const OverlayChrome = (props: {
  showMenuButton: boolean;
  onMenuClicked: () => void;
}) => (
  <Box
    sx={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      px: 1,
      pt: 0.5,
      pb: 3,
      display: "flex",
      alignItems: "center",
      gap: 1,
      pointerEvents: "none",
      // A cream scrim now, matching the paper the rest of the app is on: the
      // chrome has to stay legible over sea, land and every mark alike.
      background:
        "linear-gradient(to bottom, rgba(247, 245, 236, 0.92) 0%, rgba(247, 245, 236, 0) 100%)",
    }}
  >
    <Box sx={{ pointerEvents: "auto", minWidth: 40 }}>
      {props.showMenuButton && <HomeButton onClick={props.onMenuClicked} />}
    </Box>
    <Wordmark fontSize="1.5rem" />
  </Box>
);

const Base = (props: BaseProps) => {
  if (props.fullBleed) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {props.children}
        <OverlayChrome
          showMenuButton={props.showMenuButton}
          onMenuClicked={props.onMenuClicked}
        />
      </Box>
    );
  }

  return (
    <>
      {props.backdrop}
      <Container
        maxWidth="sm"
        sx={{
          textAlign: "center",
          // Above the backdrop, which is fixed at z-index 0: the column paints
          // over it rather than being tinted by it.
          position: "relative",
          zIndex: 1,
          py: 2,
          px: 2,
        }}
      >
        <Box sx={{ position: "relative", mb: 1 }}>
          {props.showMenuButton && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <HomeButton onClick={props.onMenuClicked} />
            </Box>
          )}
          <Wordmark />
        </Box>
        {props.children}
      </Container>
    </>
  );
};

export default Base;
