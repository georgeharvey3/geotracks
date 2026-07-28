import { useCallback, useEffect, useRef, useState } from "react";
import { Song } from "../types";

export interface SongMetadata {
  trackTitle?: string;
  artistName?: string;
  thumbnailUrl?: string;
}

export interface SpotifyPlayer {
  // Callback ref for the hidden embed element; wiring this triggers controller
  // creation once the Spotify IFrame API is ready and a song is pending.
  embedRef: (node: HTMLDivElement | null) => void;
  songReady: boolean;
  songPlaying: boolean;
  songFinished: boolean;
  songLoadFailed: boolean;
  metadata: SongMetadata;
  // Play/pause with replay handling when the clip has finished.
  onPlayClicked: () => void;
  // Raw play/pause toggle (used for desktop auto-play on a new question).
  togglePlay: () => void;
  onRetryLoad: () => void;
}

const MAX_AUTO_RETRIES = 3;
const LOAD_TIMEOUT_MS = 10000;
const CLIP_DURATION_MS = 30000;

// Convert a Spotify URL to a URI: .../track/XXX -> spotify:track:XXX
function toSpotifyUri(url: string): string {
  const match = url.match(
    /open\.spotify\.com\/(track|album|episode)\/([a-zA-Z0-9]+)/,
  );
  if (match) return `spotify:${match[1]}:${match[2]}`;
  return url;
}

/**
 * Owns the imperative Spotify IFrame integration: controller lifecycle,
 * oEmbed metadata, playback event handling (via the controller's `ready` /
 * `playback_update` listeners), and load retries. Kept outside the game reducer
 * so the whole side-effectful surface can be mocked at this seam.
 */
export default function useSpotifyPlayer(song: Song): SpotifyPlayer {
  const [songReady, setSongReady] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);
  const [songFinished, setSongFinished] = useState(false);
  const [songLoadFailed, setSongLoadFailed] = useState(false);
  const [metadata, setMetadata] = useState<SongMetadata>({});

  const embedElementRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const iframeApiRef = useRef<SpotifyIFrameAPI | null>(null);
  const pendingSongRef = useRef<string | null>(null);
  const songLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const replayPendingRef = useRef(false);

  const destroyController = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
    if (embedElementRef.current) {
      embedElementRef.current.innerHTML = "";
    }
  }, []);

  // Create the controller once the API is ready, the element exists, and a
  // song is pending. Wires ready/playback listeners on the new controller.
  const initController = useCallback((IFrameAPI: SpotifyIFrameAPI) => {
    iframeApiRef.current = IFrameAPI;
    if (controllerRef.current || !embedElementRef.current) return;
    if (!pendingSongRef.current) return;

    const initialUri = toSpotifyUri(pendingSongRef.current);
    pendingSongRef.current = null;

    IFrameAPI.createController(
      embedElementRef.current,
      { uri: initialUri, width: "100%", height: 152 },
      (controller) => {
        controllerRef.current = controller;
        controller.addListener("ready", () => {
          if (songLoadTimerRef.current) {
            clearTimeout(songLoadTimerRef.current);
            songLoadTimerRef.current = null;
          }
          retryCountRef.current = 0;
          setSongLoadFailed(false);
          setSongReady(true);
          setSongFinished(false);
          if (replayPendingRef.current) {
            replayPendingRef.current = false;
            controller.togglePlay();
          }
        });
        controller.addListener("playback_update", (e) => {
          const { isPaused, position, duration } = e.data;
          const isClipFinished = duration > 0 && position >= CLIP_DURATION_MS;
          const isFinished =
            duration > 0 && (position >= duration || isClipFinished);
          if (isClipFinished && !isPaused) {
            controller.togglePlay();
          }
          setSongPlaying(!isPaused && !isFinished);
          if (isFinished) {
            setSongFinished(true);
          } else if (!isPaused) {
            setSongFinished(false);
          }
        });
      },
    );
  }, []);

  // Callback ref: init as soon as the embed element mounts (handles the Game
  // screen mounting after the IFrame API has already loaded).
  const embedRef = useCallback(
    (node: HTMLDivElement | null) => {
      embedElementRef.current = node;
      if (node && iframeApiRef.current && !controllerRef.current) {
        initController(iframeApiRef.current);
      }
    },
    [initController],
  );

  // Register the API-ready global once.
  useEffect(() => {
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      initController(IFrameAPI);
    };
  }, [initController]);

  const attemptLoad = useCallback(
    (songLink: string) => {
      setSongReady(false);
      setSongPlaying(false);
      setSongLoadFailed(false);
      if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);

      songLoadTimerRef.current = setTimeout(() => {
        if (retryCountRef.current < MAX_AUTO_RETRIES) {
          retryCountRef.current += 1;
          destroyController();
          attemptLoad(songLink);
        } else {
          console.warn("[useSpotifyPlayer] all retries exhausted, load failed");
          setSongLoadFailed(true);
        }
      }, LOAD_TIMEOUT_MS);

      if (controllerRef.current) {
        controllerRef.current.loadUri(toSpotifyUri(songLink));
      } else {
        pendingSongRef.current = songLink;
        if (iframeApiRef.current) {
          initController(iframeApiRef.current);
        }
      }
    },
    [destroyController, initController],
  );

  // Load the track (and fetch its oEmbed metadata) whenever the song changes.
  useEffect(() => {
    if (!song || !song.link) return;
    const songLink = song.link;

    retryCountRef.current = 0;
    setSongFinished(false);
    setMetadata({});
    attemptLoad(songLink);

    let cancelled = false;
    const fetchOembed = (attempt = 0, maxRetries = 3, delay = 1000) => {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(
        songLink,
      )}`;
      fetch(oembedUrl)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setMetadata({
            trackTitle: data.title,
            artistName: data.author_name,
            thumbnailUrl: data.thumbnail_url,
          });
        })
        .catch((err) => {
          if (cancelled) return;
          if (attempt < maxRetries) {
            setTimeout(
              () => fetchOembed(attempt + 1, maxRetries, delay),
              delay,
            );
          } else {
            console.error(
              "[useSpotifyPlayer] oEmbed metadata failed:",
              err?.message || err,
            );
          }
        });
    };
    fetchOembed();

    return () => {
      cancelled = true;
      if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);
    };
  }, [song, attemptLoad]);

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const onPlayClicked = useCallback(() => {
    // Restart from the top when the clip has already finished.
    if (songFinished && controllerRef.current && song?.link) {
      replayPendingRef.current = true;
      controllerRef.current.loadUri(toSpotifyUri(song.link));
      setSongFinished(false);
      return;
    }
    togglePlay();
  }, [songFinished, song, togglePlay]);

  const onRetryLoad = useCallback(() => {
    if (!song || !song.link) return;
    destroyController();
    retryCountRef.current = 0;
    attemptLoad(song.link);
  }, [song, destroyController, attemptLoad]);

  // Tear down the controller and any pending load timer when the hook unmounts
  // (e.g. leaving the game for the menu or final score), mirroring the previous
  // explicit cleanup and stopping playback.
  useEffect(() => {
    return () => {
      destroyController();
      if (songLoadTimerRef.current) {
        clearTimeout(songLoadTimerRef.current);
        songLoadTimerRef.current = null;
      }
    };
  }, [destroyController]);

  return {
    embedRef,
    songReady,
    songPlaying,
    songFinished,
    songLoadFailed,
    metadata,
    onPlayClicked,
    togglePlay,
    onRetryLoad,
  };
}
