import React from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import SkipNextIcon from "@mui/icons-material/SkipNext";

import CountryInput from "../CountryInput/CountryInput";
import CurrentScore from "../CurrentScore/CurrentScore";
import Guesses from "../Guesses/Guesses";
import PlayerControls from "../PlayerControls/PlayerControls";
import Slider from "../Slider/Slider";
import TrackReveal from "../TrackReveal/TrackReveal";

import { LANDSCAPE_MEDIA, PORTRAIT_PANEL_MAX_HEIGHT } from "../../layout";
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
  score: number;
  countryInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * Everything that isn't the map, gathered into one panel: player, prompt, both
 * guess inputs, the running board, and the round-end reveal.
 *
 * Portrait: a tray in normal flow, no taller than its own content — the map
 * gets everything it doesn't claim, and the guess board stays collapsed so
 * everything in the tray is visible without scrolling.
 * Landscape: a card floating over the top-right of the map, deliberately
 * occluding it — the map pans and zooms underneath, and the panel is the one
 * thing the player needs pinned in place.
 */
const ControlPanel = (props: ControlPanelProps) => (
  <Box
    sx={{
      position: "relative",
      zIndex: 3,
      // Sized to content, capped so an expanded guess board can never squeeze
      // the map out; past the cap the tray scrolls on its own.
      flex: "0 1 auto",
      minHeight: 0,
      maxHeight: PORTRAIT_PANEL_MAX_HEIGHT,
      overflowY: "auto",
      // The map claims every touch gesture for pan/zoom; the panel needs its
      // own back so a long guess list can be scrolled.
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
    {props.isCompetition && (
      <CurrentScore score={props.score} turnsRemaining={props.turnsRemaining} />
    )}

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

    <Slider checked={props.showGeoHints} onCheck={props.onCheck} />
    {props.isCompetition && (
      <Typography
        variant="caption"
        sx={{ display: "block", color: "warning.main", fontStyle: "italic" }}
      >
        Enabling GeoHints will score half points
      </Typography>
    )}

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
  </Box>
);

export default ControlPanel;
