import React from "react";
import { Box, Button, IconButton, Typography, CircularProgress } from "@mui/material";
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

// Play/pause/replay button, with the load-failure retry fallback.
const PlayerControls = (props: PlayerControlsProps) => {
  let buttonIcon = <CircularProgress size={32} color="inherit" />;
  if (props.songReady) {
    if (props.songFinished) {
      buttonIcon = <ReplayIcon sx={{ fontSize: 36 }} />;
    } else if (props.songPlaying) {
      buttonIcon = <PauseIcon sx={{ fontSize: 36 }} />;
    } else {
      buttonIcon = <PlayArrowIcon sx={{ fontSize: 36 }} />;
    }
  }

  if (props.songLoadFailed) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", my: 3, gap: 1.5 }}>
        <ErrorOutlineIcon sx={{ fontSize: 48, color: "error.main" }} />
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Song failed to load
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={props.onRetryLoad}
          sx={{ mt: 0.5 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
      <IconButton
        disabled={!props.songReady}
        onClick={props.onPlayClicked}
        sx={{
          width: 80,
          height: 80,
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
    </Box>
  );
};

export default PlayerControls;
