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
        bgcolor: "background.paper",
        border: "2px solid",
        borderColor: "divider",
        color: "primary.main",
        "&:hover": {
          bgcolor: "action.hover",
        },
        "&:disabled": {
          color: "text.disabled",
          bgcolor: "background.paper",
          borderColor: "divider",
        },
      }}
    >
      {buttonIcon}
    </IconButton>
  );
};

export default PlayerControls;
