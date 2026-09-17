import { useCallback, useEffect, useRef, useState } from "react";
import { Song, SongMetadata } from "../types";
import { whenIFrameApi } from "../spotify/iframeApi";

export interface SpotifyPlayer {
  // Callback ref for the hidden embed element; wiring this triggers controller
  // creation once the Spotify IFrame API is ready and a song is pending.
  embedRef: (node: HTMLDivElement | null) => void;
  songReady: boolean;
  songPlaying: boolean;
  songFinished: boolean;
  songLoadFailed: boolean;
  metadata: SongMetadata;
  /**
   * The Song link `metadata` was fetched for, or undefined while none has
   * resolved for the current Song. A caller that stores metadata needs this:
   * the two travel together, so metadata can never be filed under the wrong
   * Song when a fetch resolves after the Song has moved on.
   */
  metadataLink: string | undefined;
  /**
   * The link of a Song the embed loaded and then would not start — asked to
   * play, it reported nothing at all. Spotify's embed plays a track's preview
   * for a listener who is not signed in, and a track with none (region, or
   * simply no preview cut) loads to a working-looking player whose play button
   * does nothing. The embed has no event for it, so the silence is the signal:
   * see `PLAY_TIMEOUT_MS`. Undefined otherwise, and cleared by the next load.
   */
  unplayableLink: string | undefined;
  // Play/pause with replay handling when the clip has finished.
  onPlayClicked: () => void;
  // Raw play/pause toggle (used for desktop auto-play on a new question).
  togglePlay: () => void;
  onRetryLoad: () => void;
}

const MAX_AUTO_RETRIES = 3;
const LOAD_TIMEOUT_MS = 10000;
/**
 * How long a play request may go unanswered before the Song is called
 * unplayable. A playable track reports playback (buffering counts) well inside
 * a second; the margin is for a slow phone on a slow link, and the cost of
 * getting it wrong is small either way — the caller swaps in another cut of the
 * same album, which is a different track and not a lost turn.
 */
const PLAY_TIMEOUT_MS = 3000;

// One frozen empty object, so "nothing fetched yet" keeps a stable identity for
// consumers that depend on `metadata`.
const NO_METADATA: SongMetadata = {};

export interface SpotifyPlayerOptions {
  /**
   * Cap playback at this many ms, the length of a Clip. Omit to play the whole
   * Song — a listener signed in to Spotify hears all of it, and everyone else
   * still gets Spotify's own preview limit.
   */
  clipDurationMs?: number;
}

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
 *
 * `song` may be undefined for a surface that has nothing chosen yet.
 */
export default function useSpotifyPlayer(
  song: Song | undefined,
  options: SpotifyPlayerOptions = {},
): SpotifyPlayer {
  const [songReady, setSongReady] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);
  const [songFinished, setSongFinished] = useState(false);
  const [songLoadFailed, setSongLoadFailed] = useState(false);
  const [unplayableLink, setUnplayableLink] = useState<string | undefined>(
    undefined,
  );
  // Metadata and the link it describes are one value, so they can never be read
  // apart from each other.
  const [fetchedMetadata, setFetchedMetadata] = useState<{
    link: string;
    metadata: SongMetadata;
  } | null>(null);

  const embedElementRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const iframeApiRef = useRef<SpotifyIFrameAPI | null>(null);
  const pendingSongRef = useRef<string | null>(null);
  /**
   * Which embed the controller being built belongs to. Creating a controller is
   * asynchronous and nothing about it can be cancelled, so anything that tears
   * the embed down bumps this: a controller that answers afterwards was built
   * against an element that has since been wiped, and adopting it would leave
   * the play button wired to an iframe that is no longer on the page.
   */
  const embedGenerationRef = useRef(0);
  /** Our place in the queue for the API, while the page is still without it. */
  const unsubscribeApiRef = useRef<(() => void) | null>(null);
  const songLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const replayPendingRef = useRef(false);
  /** The play request in flight: nothing has answered it yet. */
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The link the embed currently holds, for the listeners wired once. */
  const currentLinkRef = useRef<string | undefined>(undefined);

  // The controller's listeners are wired once, so anything they need to read
  // later travels by ref.
  const clipDurationRef = useRef(options.clipDurationMs);
  clipDurationRef.current = options.clipDurationMs;
  const playingRef = useRef(false);
  const selfPausedRef = useRef(false);

  const destroyController = useCallback(() => {
    // Everything in flight for the old embed is now somebody else's controller.
    embedGenerationRef.current += 1;
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
    if (embedElementRef.current) {
      embedElementRef.current.innerHTML = "";
    }
  }, []);

  const clearPlayWatch = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  /**
   * Start the clock on a request to *play*. Every ask goes through here — the
   * button, the keyboard, the replay after a finished Clip — and the first
   * playback report of any kind stops it. Fire, and the Song is reported as
   * one the embed would not start.
   */
  const armPlayWatch = useCallback(() => {
    clearPlayWatch();
    const link = currentLinkRef.current;
    if (!link) return;
    playTimerRef.current = setTimeout(() => {
      playTimerRef.current = null;
      setUnplayableLink(link);
    }, PLAY_TIMEOUT_MS);
  }, [clearPlayWatch]);

  /**
   * Start the clock on a load that has actually been issued.
   *
   * It is armed where the embed is asked to do something — a controller
   * created, or a new URI loaded into one — and deliberately not when a load is
   * merely *wanted*. While the page is still waiting for the API script there is
   * no embed to time out, and a watchdog armed then spent its three retries
   * tearing down and rebuilding an embed that had never been given a chance to
   * start: on a cold connection, which is exactly when the script is slow, the
   * retries made the load slower and then declared it failed.
   *
   * The body belongs to whichever load is current, so it travels by ref rather
   * than through a dependency of everything that arms it.
   */
  const armLoadTimeoutRef = useRef<(() => void) | null>(null);
  const armLoadTimeout = useCallback(() => armLoadTimeoutRef.current?.(), []);

  // Create the controller once the API is ready, the element exists, and a
  // song is pending. Wires ready/playback listeners on the new controller.
  const initController = useCallback(
    (IFrameAPI: SpotifyIFrameAPI) => {
      iframeApiRef.current = IFrameAPI;
      if (controllerRef.current || !embedElementRef.current) return;
      if (!pendingSongRef.current) return;

      const initialUri = toSpotifyUri(pendingSongRef.current);
      pendingSongRef.current = null;
      const generation = embedGenerationRef.current;
      armLoadTimeout();

      IFrameAPI.createController(
        embedElementRef.current,
        { uri: initialUri, width: "100%", height: 152 },
        (controller) => {
          // The load timed out and the embed was rebuilt (or the screen was left)
          // while this one was being built. Its iframe went with the element it
          // was drawn into, so it can neither play nor be stopped — and the two
          // creations can answer in either order, so without this the *live*
          // controller is the one that gets dropped, the round reports itself
          // ready, and the play button does nothing at all.
          if (generation !== embedGenerationRef.current) {
            try {
              controller.destroy();
            } catch {
              // Its element is already gone; there is nothing left to tear down.
            }
            return;
          }

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
              armPlayWatch();
              controller.togglePlay();
            }
          });
          controller.addListener("playback_update", (e) => {
            const { isPaused, isBuffering, position, duration } = e.data;
            const clipDuration = clipDurationRef.current;

            // The embed took the play request: it is playing, or fetching in
            // order to. A report of "still paused" is what an unplayable track
            // sends too, if it sends anything, so only life counts.
            if (!isPaused || isBuffering) clearPlayWatch();

            // Capped: the Clip ends where the cap says, and we stop it ourselves.
            const isClipFinished =
              clipDuration !== undefined &&
              duration > 0 &&
              position >= clipDuration;
            if (isClipFinished && !isPaused) {
              controller.togglePlay();
            }

            // Uncapped, position reaching duration is not a signal we can rely
            // on: the embed reports the whole Song's duration to a listener who
            // is not signed in to Spotify, but only plays its own ~30s preview,
            // so position never gets there and the Song would never read as
            // ended. What holds either way is that playback stopped and we were
            // not the ones who stopped it.
            const stoppedItself =
              clipDuration === undefined &&
              isPaused &&
              position > 0 &&
              playingRef.current &&
              !selfPausedRef.current;

            const isFinished =
              (duration > 0 && position >= duration) ||
              isClipFinished ||
              stoppedItself;

            // A pause we asked for is spent once it has been reported.
            if (isPaused) selfPausedRef.current = false;

            playingRef.current = !isPaused && !isFinished;
            setSongPlaying(!isPaused && !isFinished);
            if (isFinished) {
              setSongFinished(true);
            } else if (!isPaused) {
              setSongFinished(false);
            }
          });
        },
      );
    },
    [armLoadTimeout, armPlayWatch, clearPlayWatch],
  );

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

  /**
   * Ask the page for the IFrame API, which answers at once if it already has it
   * (`src/spotify/iframeApi.ts`). This is deliberately *not* a registration of
   * our own: the script announces itself once per page and long before some
   * players mount, so a player that listened for the announcement itself would
   * only hear one that happened to land while it was on screen.
   */
  const requestApi = useCallback(() => {
    unsubscribeApiRef.current?.();
    unsubscribeApiRef.current = whenIFrameApi(initController);
  }, [initController]);

  const attemptLoad = useCallback(
    (songLink: string) => {
      setSongReady(false);
      setSongPlaying(false);
      setSongLoadFailed(false);
      playingRef.current = false;
      selfPausedRef.current = false;
      if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);

      armLoadTimeoutRef.current = () => {
        if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);
        songLoadTimerRef.current = setTimeout(() => {
          if (retryCountRef.current < MAX_AUTO_RETRIES) {
            retryCountRef.current += 1;
            destroyController();
            attemptLoad(songLink);
          } else {
            console.warn(
              "[useSpotifyPlayer] all retries exhausted, load failed",
            );
            setSongLoadFailed(true);
          }
        }, LOAD_TIMEOUT_MS);
      };

      if (controllerRef.current) {
        armLoadTimeout();
        controllerRef.current.loadUri(toSpotifyUri(songLink));
      } else {
        // No timer yet: `initController` arms one when it has an API and an
        // element to build against, which is the first moment there is an embed
        // whose silence means anything.
        pendingSongRef.current = songLink;
        requestApi();
      }
    },
    [armLoadTimeout, destroyController, requestApi],
  );

  // Load the track (and fetch its oEmbed metadata) whenever the song changes.
  //
  // Keyed on the link rather than the Song, because the link is the only part of
  // a Song the embed can act on. A caller may well hand back a new Song object
  // for the same track — the game reducer does exactly that when it merges this
  // hook's own oEmbed metadata onto the round's Song — and reloading on that
  // would drop the player back to Loading and stop the music mid-Clip, then
  // re-fetch, re-merge and do it again.
  const songLink = song?.link;
  useEffect(() => {
    if (!songLink) return;

    currentLinkRef.current = songLink;
    clearPlayWatch();
    setUnplayableLink(undefined);
    retryCountRef.current = 0;
    setSongFinished(false);
    setFetchedMetadata(null);
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
          setFetchedMetadata({
            link: songLink,
            metadata: {
              trackTitle: data.title,
              artistName: data.author_name,
              thumbnailUrl: data.thumbnail_url,
            },
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
  }, [songLink, attemptLoad, clearPlayWatch]);

  const togglePlay = useCallback(() => {
    // Remember a pause we asked for, so the next report of one isn't mistaken
    // for playback stopping by itself.
    if (playingRef.current) {
      selfPausedRef.current = true;
    } else {
      armPlayWatch();
    }
    controllerRef.current?.togglePlay();
  }, [armPlayWatch]);

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
      clearPlayWatch();
      unsubscribeApiRef.current?.();
      unsubscribeApiRef.current = null;
      if (songLoadTimerRef.current) {
        clearTimeout(songLoadTimerRef.current);
        songLoadTimerRef.current = null;
      }
    };
  }, [destroyController, clearPlayWatch]);

  return {
    embedRef,
    songReady,
    songPlaying,
    songFinished,
    songLoadFailed,
    metadata: fetchedMetadata?.metadata ?? NO_METADATA,
    metadataLink: fetchedMetadata?.link,
    unplayableLink,
    onPlayClicked,
    togglePlay,
    onRetryLoad,
  };
}
