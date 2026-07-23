import React from "react";
import { Box, Button, Typography } from "@mui/material";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import CountryInput from "../CountryInput/CountryInput";
import Slider from "../Slider/Slider";
import Guesses from "../Guesses/Guesses";
import CurrentScore from "../CurrentScore/CurrentScore";
import PlayerControls from "../PlayerControls/PlayerControls";
import TrackReveal from "../TrackReveal/TrackReveal";

import { Guess, Song } from "../../types";

interface GameProps {
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
  embedRef: React.Ref<HTMLDivElement>;
  isCompetition: boolean;
  turnsRemaining: number;
  score: number;
  countryInputRef: React.RefObject<HTMLInputElement>;
}

const Game = (props: GameProps) => {
  return (
    <Box>
      {props.isCompetition && (
        <CurrentScore
          score={props.score}
          turnsRemaining={props.turnsRemaining}
        />
      )}

      <PlayerControls
        songReady={props.songReady}
        songLoadFailed={props.songLoadFailed}
        songFinished={props.songFinished}
        songPlaying={props.songPlaying}
        onRetryLoad={props.onRetryLoad}
        onPlayClicked={props.onPlayClicked}
      />

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

          <TrackReveal song={props.song} />
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
