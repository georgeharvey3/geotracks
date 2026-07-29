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
  children: React.ReactNode;
}

const TITLE_GRADIENT = {
  background: "linear-gradient(135deg, #1e88e5 0%, #66bb6a 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
} as const;

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
 * keeps the gradient title legible over whatever the map draws beneath it.
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
      background:
        "linear-gradient(to bottom, rgba(26, 26, 46, 0.85) 0%, rgba(26, 26, 46, 0) 100%)",
    }}
  >
    <Box sx={{ pointerEvents: "auto", minWidth: 40 }}>
      {props.showMenuButton && <HomeButton onClick={props.onMenuClicked} />}
    </Box>
    <Typography variant="h1" sx={{ ...TITLE_GRADIENT, fontSize: "1.5rem" }}>
      GeoTracks
    </Typography>
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
    <Container
      maxWidth="sm"
      sx={{
        textAlign: "center",
        position: "relative",
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
        <Typography variant="h1" sx={{ ...TITLE_GRADIENT, py: 1 }}>
          GeoTracks
        </Typography>
      </Box>
      {props.children}
    </Container>
  );
};

export default Base;
