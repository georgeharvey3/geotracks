import React, { useEffect, useRef } from "react";

import Explore from "../Explore/Explore";
import { useExplore } from "../../context/ExploreContext";
import { currentSong } from "../../state/exploreReducer";
import useSpotifyPlayer from "../../hooks/useSpotifyPlayer";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";

/**
 * Container for the Explore screen. Owns the Spotify player and keyboard seams
 * and wires them to the Explore reducer via context, so <Explore> stays purely
 * presentational.
 *
 * Unmounting this stops the music: the player hook tears its controller down.
 * The queues live above it, in the provider, so they survive the trip.
 */
const ExploreScreen = () => {
  const { state, dispatch } = useExplore();
  const countryInputRef = useRef<HTMLInputElement>(null);
  const song = currentSong(state);
  // No Clip cap: Explore is a listening surface, so a listener signed in to
  // Spotify hears the whole Song.
  const player = useSpotifyPlayer(song);
  const wasReadyRef = useRef(false);
  const wasFinishedRef = useRef(false);

  const skip = () => dispatch({ type: "SKIP" });

  useKeyboardShortcuts({
    inputRef: countryInputRef,
    onPlay: player.onPlayClicked,
    onNext: skip,
  });

  // Choosing a country and skipping both start playing by themselves: the
  // click on the map is the user gesture, on every device. Fire only on the
  // not-ready -> ready transition, so a re-render can't re-toggle a Song the
  // player has since paused.
  useEffect(() => {
    const becameReady = !wasReadyRef.current && player.songReady;
    wasReadyRef.current = player.songReady;
    if (becameReady) player.togglePlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.songReady]);

  // A Song that runs out advances the queue, so choosing a country yields
  // continuous listening. Pausing never reaches here, so pause means pause.
  useEffect(() => {
    const justFinished = !wasFinishedRef.current && player.songFinished;
    wasFinishedRef.current = player.songFinished;
    if (justFinished) skip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.songFinished]);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const country = formData.get("myCountry") as string | null;
    if (country) dispatch({ type: "SELECT_COUNTRY", country });
  };

  // Merge live oEmbed metadata onto the Song for display — only the metadata
  // fetched for this Song, so a fetch that resolves after a skip is ignored.
  const metadata = player.metadataLink === song?.link ? player.metadata : {};
  const displayedSong = song && { ...song, ...metadata };

  return (
    <Explore
      playableCountries={state.playableCountries}
      country={state.country}
      song={displayedSong}
      songReady={player.songReady}
      songLoadFailed={player.songLoadFailed}
      songFinished={player.songFinished}
      songPlaying={player.songPlaying}
      onRetryLoad={player.onRetryLoad}
      onPlayClicked={player.onPlayClicked}
      onSkipClicked={skip}
      onSelectCountry={(country) =>
        dispatch({ type: "SELECT_COUNTRY", country })
      }
      onFormSubmit={onFormSubmit}
      embedRef={player.embedRef}
      countryInputRef={countryInputRef}
    />
  );
};

export default ExploreScreen;
