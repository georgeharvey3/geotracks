import React from "react";
import { Box } from "@mui/material";

import ExploreMap from "../ExploreMap/ExploreMap";
import ExplorePanel from "../ExplorePanel/ExplorePanel";

import { Song } from "../../types";

interface ExploreProps {
  playableCountries: string[];
  country: string | null;
  song: Song | undefined;
  songReady: boolean;
  songLoadFailed: boolean;
  songFinished: boolean;
  songPlaying: boolean;
  onRetryLoad: () => void;
  onPlayClicked: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSkipClicked: () => void;
  onSelectCountry: (countryName: string) => void;
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** The silent country the player has picked in order to ask about it. */
  askedAboutCountry: string | null;
  onAskAboutCountry: (countryName: string) => void;
  onSuggestClicked: () => void;
  embedRef: React.Ref<HTMLDivElement>;
  countryInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * The Explore screen, laid out exactly as the game screen is: in landscape the
 * map covers the viewport and the panel floats over a corner of it; in portrait
 * they stack, the panel taking only the height its content needs. Nothing here
 * scrolls — the page must not move under a pan gesture.
 */
const Explore = (props: ExploreProps) => (
  <Box
    sx={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
    }}
  >
    <Box sx={{ flex: "1 1 auto", minHeight: 0 }}>
      <ExploreMap
        playableCountries={props.playableCountries}
        selectedCountry={props.country}
        askedAboutCountry={props.askedAboutCountry}
        onSelect={props.onSelectCountry}
        onAskAbout={props.onAskAboutCountry}
      />
    </Box>

    <ExplorePanel
      country={props.country}
      song={props.song}
      songReady={props.songReady}
      songLoadFailed={props.songLoadFailed}
      songFinished={props.songFinished}
      songPlaying={props.songPlaying}
      onRetryLoad={props.onRetryLoad}
      onPlayClicked={props.onPlayClicked}
      onSkipClicked={props.onSkipClicked}
      onFormSubmit={props.onFormSubmit}
      askedAboutCountry={props.askedAboutCountry}
      onSuggestClicked={props.onSuggestClicked}
      playableCountries={props.playableCountries}
      countryInputRef={props.countryInputRef}
    />

    <div className="iframe-wrapper" style={{ height: 0, overflow: "hidden" }}>
      <div id="embed-iframe" ref={props.embedRef}></div>
    </div>
  </Box>
);

export default Explore;
