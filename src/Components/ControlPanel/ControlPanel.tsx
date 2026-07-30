import React from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import SkipNextIcon from "@mui/icons-material/SkipNext";

import CountryInput from "../CountryInput/CountryInput";
import Guesses from "../Guesses/Guesses";
import PanelSurface from "../PanelSurface/PanelSurface";
import PlayerControls from "../PlayerControls/PlayerControls";
import Slider from "../Slider/Slider";
import TrackReveal from "../TrackReveal/TrackReveal";

import { Guess, Song } from "../../types";

interface ControlPanelProps {
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
  isCompetition: boolean;
  turnsRemaining: number;
  countryInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * Everything the player *acts* with, gathered into one panel: player, prompt,
 * both guess inputs, the running board, and the round-end reveal. The guess
 * board stays collapsed so everything in the tray is visible without scrolling.
 * The Competition standings are deliberately not here — they are read, not
 * acted on, and live on their own plaque over the map (`CurrentScore`).
 */
const ControlPanel = (props: ControlPanelProps) => (
  <PanelSurface>
    {/* The retry fallback replaces the play button with a full-width row, so
        the prompt steps aside: there is nothing to listen to yet. */}
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <PlayerControls
        songReady={props.songReady}
        songLoadFailed={props.songLoadFailed}
        songFinished={props.songFinished}
        songPlaying={props.songPlaying}
        onRetryLoad={props.onRetryLoad}
        onPlayClicked={props.onPlayClicked}
      />
      {!props.songLoadFailed && (
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", textAlign: "left" }}
        >
          Which country does this song originate from?
        </Typography>
      )}
    </Stack>

    <Box sx={{ mt: 1.5 }}>
      <CountryInput
        ref={props.countryInputRef}
        onFormSubmit={props.onFormSubmit}
        disabled={props.finished}
      />
      <Typography
        variant="caption"
        sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
      >
        Click a country, or type its name
      </Typography>
    </Box>

    {/* The hints toggle sits with the inputs, above the board: it governs the
        next guess, and the board below it grows tall enough to scroll. */}
    <Divider sx={{ mt: 1 }} />

    {/* What hints cost rides alongside the toggle as a quiet aside. It was a
        standing red warning underneath, which spent the screen's one loud
        colour on a line that is true whether or not the player ever touches
        the switch. */}
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Slider checked={props.showGeoHints} onCheck={props.onCheck} />
      {props.isCompetition && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          half points
        </Typography>
      )}
    </Stack>

    {props.errorMessage && (
      <Typography color="error" variant="body2" sx={{ mt: 1 }}>
        {props.errorMessage}
      </Typography>
    )}

    {props.submitted && (
      <Guesses
        guesses={props.guesses}
        showGeoHints={props.showGeoHints}
        roundOver={props.finished}
      />
    )}

    {props.finished && (
      <Stack alignItems="center" spacing={1.5} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<SkipNextIcon />}
          onClick={props.onNextSongClicked}
        >
          {props.turnsRemaining === 0 ? "Continue" : "Next Song"}
        </Button>
        <TrackReveal song={props.song} />
      </Stack>
    )}
  </PanelSurface>
);

export default ControlPanel;
