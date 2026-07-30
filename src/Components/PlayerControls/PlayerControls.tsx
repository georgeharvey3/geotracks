import React from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import RefreshIcon from "@mui/icons-material/Refresh";
import { COLORS } from "../../tokens";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

interface PlayerControlsProps {
  songReady: boolean;
  songLoadFailed: boolean;
  songFinished: boolean;
  songPlaying: boolean;
  onRetryLoad: () => void;
  onPlayClicked: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// Play/pause/replay button, with the load-failure retry fallback. Sized to sit
// in a row inside the control panel, so it carries no outer margins of its own.
const PlayerControls = (props: PlayerControlsProps) => {
  let buttonIcon = <CircularProgress size={24} color="inherit" />;
  if (props.songReady) {
    if (props.songFinished) {
      buttonIcon = <ReplayIcon sx={{ fontSize: 28 }} />;
    } else if (props.songPlaying) {
      buttonIcon = <PauseIcon sx={{ fontSize: 28 }} />;
    } else {
      buttonIcon = <PlayArrowIcon sx={{ fontSize: 28 }} />;
    }
  }

  if (props.songLoadFailed) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 1,
          width: "100%",
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 24, color: "error.main" }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Song failed to load
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={props.onRetryLoad}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <IconButton
      disabled={!props.songReady}
      onClick={props.onPlayClicked}
      sx={{
        flexShrink: 0,
        width: 56,
        height: 56,
        // The screen's primary action, so it takes the primary action's shape:
        // filled in pear with an ink glyph, and the same solid edge the buttons
        // have. Drawn as a pear glyph on cream it was 1.4:1 and barely there.
        bgcolor: "primary.main",
        color: "primary.contrastText",
        boxShadow: `0 4px 0 0 ${COLORS.accentDeep}`,
        transition:
          "transform 140ms cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 140ms cubic-bezier(0.2, 0.7, 0.3, 1)",
        "&:hover": {
          bgcolor: "primary.main",
          boxShadow: `0 6px 0 0 ${COLORS.accentDeep}`,
          transform: "translateY(-2px)",
        },
        "&:active": {
          boxShadow: `0 1px 0 0 ${COLORS.accentDeep}`,
          transform: "translateY(3px)",
          transitionDuration: "70ms",
        },
        "&:disabled": {
          color: "text.disabled",
          bgcolor: "action.disabledBackground",
          boxShadow: `0 4px 0 0 ${COLORS.rule}`,
          transform: "none",
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover, &:active": { transform: "none" },
        },
      }}
    >
      {buttonIcon}
    </IconButton>
  );
};

export default PlayerControls;
