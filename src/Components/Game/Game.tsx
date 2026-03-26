import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import RefreshIcon from "@mui/icons-material/Refresh";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import AlbumIcon from "@mui/icons-material/Album";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CountryInput from "../CountryInput/CountryInput";
import Slider from "../Slider/Slider";
import Guesses from "../Guesses/Guesses";
import CurrentScore from "../CurrentScore/CurrentScore";

import { Guess, Song } from "../../types";

interface GameProps {
  setGameMode: (mode: string) => void;
  songReady: boolean;
  songLoadFailed: boolean;
  onRetryLoad: () => void;
  songFinished: boolean;
  onPlayClicked: (e: React.MouseEvent<HTMLButtonElement>) => void;
  songPlaying: boolean;
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  finished: boolean;
  showGeoHints: boolean;
  onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errorMessage: string;
  submitted: boolean;
  guesses: Guess[];
  onNextSongClicked: () => void;
  song: Song;
  embedRef: React.RefObject<HTMLDivElement | null>;
  isCompetition: boolean;
  turnsRemaining: number;
  score: number;
  countryInputRef: React.RefObject<HTMLInputElement | null>;
}

const AlbumArt = ({ src, alt }: { src?: string; alt: string }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          flexShrink: 0,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlbumIcon sx={{ fontSize: 40, color: "text.secondary" }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      sx={{
        width: 80,
        height: 80,
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
};

const Game = (props: GameProps) => {
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

  return (
    <Box>
      {props.isCompetition && (
        <CurrentScore
          score={props.score}
          turnsRemaining={props.turnsRemaining}
        />
      )}

      {props.songLoadFailed ? (
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
      ) : (
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
      )}

      <Typography variant="body1" sx={{ my: 2, color: "text.secondary" }}>
        Which country does this song originate from?
      </Typography>

      <CountryInput
        ref={props.countryInputRef}
        onFormSubmit={props.onFormSubmit}
        disabled={props.finished}
      />

      {props.isCompetition && (
        <Typography
          variant="body2"
          sx={{ mt: 1, color: "warning.main", fontStyle: "italic" }}
        >
          Enabling GeoHints will score half points
        </Typography>
      )}

      <Box sx={{ my: 2 }}>
        <Slider checked={props.showGeoHints} onCheck={props.onCheck} />
      </Box>

      {props.errorMessage && (
        <Typography color="error" sx={{ my: 1 }}>
          {props.errorMessage}
        </Typography>
      )}

      {props.submitted && (
        <Guesses guesses={props.guesses} showGeoHints={props.showGeoHints} />
      )}

      {props.finished && (
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SkipNextIcon />}
            onClick={props.onNextSongClicked}
          >
            {props.turnsRemaining === 0 ? "Continue" : "Next Song"}
          </Button>

          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 1.5,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <AlbumArt src={props.song.thumbnailUrl} alt={props.song.album} />
            <Box sx={{ minWidth: 0, overflow: "hidden" }}>
              <Typography variant="body1" sx={{ fontWeight: "bold", textOverflow: "ellipsis", overflow: "hidden" }} noWrap>
                {props.song.trackTitle || "Unknown Track"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", textOverflow: "ellipsis", overflow: "hidden" }} noWrap>
                {props.song.artistName || "Unknown Artist"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", textOverflow: "ellipsis", overflow: "hidden", display: "block" }} noWrap>
                {props.song.album}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Button
                  size="small"
                  href={props.song.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  sx={{ textTransform: "none", p: 0, minWidth: 0 }}
                >
                  Open in Spotify
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      <div
        className="iframe-wrapper"
        style={{ height: 0, overflow: "hidden" }}
      >
        <div id="embed-iframe" ref={props.embedRef}></div>
      </div>
    </Box>
  );
};

export default Game;
