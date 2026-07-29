import React from "react";
import { Box } from "@mui/material";
import ControlPanel from "../ControlPanel/ControlPanel";
import WorldMap from "../WorldMap/WorldMap";

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
  onMapCommit: (countryName: string) => void;
  song: Song;
  embedRef: React.Ref<HTMLDivElement>;
  isCompetition: boolean;
  turnsRemaining: number;
  score: number;
  countryInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * The game screen: the map is the surface and every control lives in a single
 * panel. In landscape the map covers the viewport and the panel floats over a
 * corner of it; in portrait they stack, the panel taking only the height its
 * content needs and the map taking the rest. Nothing here scrolls — the page
 * must not move under a pan gesture — so only the panel's own content can
 * overflow.
 */
const Game = (props: GameProps) => {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          // Portrait: whatever the content-sized tray leaves. Landscape: the
          // whole viewport, with the tray floating over a corner of it.
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <WorldMap
          guesses={props.guesses}
          showGeoHints={props.showGeoHints}
          answer={props.song.country}
          finished={props.finished}
          onCommit={props.onMapCommit}
        />
      </Box>

      <ControlPanel
        songReady={props.songReady}
        songLoadFailed={props.songLoadFailed}
        onRetryLoad={props.onRetryLoad}
        songFinished={props.songFinished}
        onPlayClicked={props.onPlayClicked}
        songPlaying={props.songPlaying}
        onFormSubmit={props.onFormSubmit}
        finished={props.finished}
        showGeoHints={props.showGeoHints}
        onCheck={props.onCheck}
        errorMessage={props.errorMessage}
        submitted={props.submitted}
        guesses={props.guesses}
        onNextSongClicked={props.onNextSongClicked}
        song={props.song}
        isCompetition={props.isCompetition}
        turnsRemaining={props.turnsRemaining}
        score={props.score}
        countryInputRef={props.countryInputRef}
      />

      <div className="iframe-wrapper" style={{ height: 0, overflow: "hidden" }}>
        <div id="embed-iframe" ref={props.embedRef}></div>
      </div>
    </Box>
  );
};

export default Game;
