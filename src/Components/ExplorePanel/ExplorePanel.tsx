import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import SkipNextIcon from "@mui/icons-material/SkipNext";

import CountryInput from "../CountryInput/CountryInput";
import PanelSurface from "../PanelSurface/PanelSurface";
import PlayerControls from "../PlayerControls/PlayerControls";
import TrackReveal from "../TrackReveal/TrackReveal";

import { Song } from "../../types";

interface ExplorePanelProps {
  /** The country being listened to, or null before the first choice. */
  country: string | null;
  /** The Song now playing; present exactly when a country is chosen. */
  song: Song | undefined;
  songReady: boolean;
  songLoadFailed: boolean;
  songFinished: boolean;
  songPlaying: boolean;
  onRetryLoad: () => void;
  onPlayClicked: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSkipClicked: () => void;
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** The Playable countries, the only ones the input may suggest. */
  playableCountries: string[];
  countryInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * Explore's controls: what is playing, and how to change it. Sibling of the
 * game's control panel and wearing the same surface, but with nothing to
 * withhold — the track card is shown from the first note rather than held back
 * for a reveal.
 *
 * The panel is always present. Before a country is chosen it holds an
 * instruction where the player would be, so the first choice costs no reflow.
 */
const ExplorePanel = (props: ExplorePanelProps) => (
  <PanelSurface>
    <Typography variant="h2" sx={{ fontSize: "1.25rem", mb: 1 }}>
      {props.country ?? "Explore"}
    </Typography>

    {props.song === undefined ? (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Choose a country to hear its music
      </Typography>
    ) : (
      <Stack spacing={1.5} alignItems="center">
        {/* The retry fallback replaces the play button with a full-width row,
            so Skip joins it there: recovery is one click either way. */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          flexWrap="wrap"
          spacing={1.5}
          sx={{ width: "100%" }}
        >
          <PlayerControls
            songReady={props.songReady}
            songLoadFailed={props.songLoadFailed}
            songFinished={props.songFinished}
            songPlaying={props.songPlaying}
            onRetryLoad={props.onRetryLoad}
            onPlayClicked={props.onPlayClicked}
          />
          <Button
            variant="outlined"
            startIcon={<SkipNextIcon />}
            onClick={props.onSkipClicked}
          >
            Skip
          </Button>
        </Stack>

        <TrackReveal song={props.song} />
      </Stack>
    )}

    <Box sx={{ mt: 1.5 }}>
      <CountryInput
        ref={props.countryInputRef}
        onFormSubmit={props.onFormSubmit}
        disabled={false}
        countries={props.playableCountries}
      />
      <Typography
        variant="caption"
        sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
      >
        Click a country, or type its name
      </Typography>
    </Box>
  </PanelSurface>
);

export default ExplorePanel;
