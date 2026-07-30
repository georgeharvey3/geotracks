import React, { useEffect, useRef } from "react";
import Game from "../Game/Game";
import { useGame } from "../../context/GameContext";
import { GAME_MODES, NUM_COMPETITION_TURNS } from "../../state/gameReducer";
import useSpotifyPlayer from "../../hooks/useSpotifyPlayer";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";

// How long a round's Clip runs before the player pauses it: long enough to
// place the music, short enough to keep the round moving.
const CLIP_DURATION_MS = 30000;

/**
 * Container for the active game screen. Owns the Spotify player and keyboard
 * seams and wires them to the game reducer via context, so <Game> stays purely
 * presentational.
 */
const GameScreen = () => {
  const { state, dispatch } = useGame();
  const countryInputRef = useRef<HTMLInputElement>(null);
  // A round hears a Clip, not the whole Song.
  const player = useSpotifyPlayer(state.song, {
    clipDurationMs: CLIP_DURATION_MS,
  });
  const wasReadyRef = useRef(false);

  useKeyboardShortcuts({
    inputRef: countryInputRef,
    onPlay: player.onPlayClicked,
    onNext: () => dispatch({ type: "NEXT_SONG" }),
  });

  // Auto-play a new question's clip once it becomes ready (desktop only). Fire
  // only on the not-ready -> ready transition so bumping questionIndex (while
  // the previous clip is still marked ready) can't trigger a premature toggle.
  useEffect(() => {
    const becameReady = !wasReadyRef.current && player.songReady;
    wasReadyRef.current = player.songReady;
    if (becameReady && state.questionIndex > 0 && window.innerWidth >= 1024) {
      player.togglePlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.songReady, state.questionIndex]);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const countryAnswer = formData.get("myCountry") as string | null;
    if (countryAnswer) {
      dispatch({ type: "SUBMIT_GUESS", countryAnswer });
    }
  };

  const onCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "TOGGLE_GEO_HINTS", checked: e.target.checked });
  };

  // oEmbed metadata is handed to the reducer rather than merged for display, so
  // the Song the player heard is the one the Run summary can later snapshot. The
  // link travels with it: the reducer drops metadata that has outlived its Song.
  const { metadata, metadataLink } = player;
  useEffect(() => {
    if (metadataLink === undefined) return;
    dispatch({ type: "SET_SONG_METADATA", link: metadataLink, metadata });
  }, [metadata, metadataLink, dispatch]);

  return (
    <Game
      songReady={player.songReady}
      songLoadFailed={player.songLoadFailed}
      onRetryLoad={player.onRetryLoad}
      songFinished={player.songFinished}
      onPlayClicked={player.onPlayClicked}
      songPlaying={player.songPlaying}
      onFormSubmit={onFormSubmit}
      finished={state.finished}
      showGeoHints={state.showGeoHints}
      onCheck={onCheck}
      errorMessage={state.errorMessage}
      submitted={state.submitted}
      guesses={state.guesses}
      onNextSongClicked={() => dispatch({ type: "NEXT_SONG" })}
      onMapCommit={(countryAnswer) =>
        dispatch({ type: "SUBMIT_GUESS", countryAnswer })
      }
      song={state.song}
      embedRef={player.embedRef}
      isCompetition={state.gameMode === GAME_MODES.competition}
      turnsRemaining={NUM_COMPETITION_TURNS - state.turnIndex}
      score={state.score}
      countryInputRef={countryInputRef}
    />
  );
};

export default GameScreen;
