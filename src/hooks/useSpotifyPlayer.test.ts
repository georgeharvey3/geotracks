import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import useSpotifyPlayer from "./useSpotifyPlayer";
import { Song } from "../types";

/**
 * The Spotify IFrame API, faked at the global seam the real one arrives
 * through: the hook publishes `window.onSpotifyIframeApiReady` and the script
 * calls it. Everything the hook does to the embed lands on these spies.
 */
function fakeIFrameApi() {
  const readyListeners: (() => void)[] = [];
  const playbackListeners: ((e: SpotifyPlaybackEvent) => void)[] = [];

  const controller: SpotifyEmbedController = {
    togglePlay: vi.fn(),
    seek: vi.fn(),
    loadUri: vi.fn(),
    destroy: vi.fn(),
    addListener: ((event: string, callback: never) => {
      if (event === "ready") readyListeners.push(callback);
      if (event === "playback_update") playbackListeners.push(callback);
    }) as SpotifyEmbedController["addListener"],
  };

  const api: SpotifyIFrameAPI = {
    createController: vi.fn((_element, _options, callback) =>
      callback(controller),
    ),
  };

  return {
    api,
    controller,
    emitReady: () => readyListeners.forEach((listener) => listener()),
    emitPlayback: (data: Partial<SpotifyPlaybackData>) =>
      playbackListeners.forEach((listener) =>
        listener({
          data: {
            isPaused: false,
            isBuffering: false,
            position: 0,
            duration: 200000,
            ...data,
          },
        }),
      ),
  };
}

const SONG: Song = {
  country: "Mali",
  link: "https://open.spotify.com/track/abc123",
  album: "Ali Farka Touré",
};

const METADATA = {
  title: "Diaraby",
  author_name: "Ali Farka Touré",
  thumbnail_url: "https://i.scdn.co/image/abc123",
};

// A Clip cap, as the game screen passes one.
const OPTIONS = { clipDurationMs: 30000 };

async function renderPlayer(song: Song) {
  const spotify = fakeIFrameApi();
  const rendered = renderHook(
    ({ song }: { song: Song }) => useSpotifyPlayer(song, OPTIONS),
    { initialProps: { song } },
  );

  // The consumer wires the embed element, then the API script announces itself.
  act(() => rendered.result.current.embedRef(document.createElement("div")));
  act(() => window.onSpotifyIframeApiReady!(spotify.api));
  // Let the oEmbed fetch settle, so it can't land mid-assertion later on.
  await settle();

  return { ...rendered, spotify };
}

// Flush the microtasks a resolved fetch is waiting behind.
const settle = () => act(async () => {});

describe("useSpotifyPlayer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve(METADATA) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.onSpotifyIframeApiReady;
  });

  it("loads the song and reports it ready", async () => {
    const { result, spotify } = await renderPlayer(SONG);

    expect(spotify.api.createController).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uri: "spotify:track:abc123" }),
      expect.any(Function),
    );

    act(() => spotify.emitReady());
    expect(result.current.songReady).toBe(true);
    expect(result.current.metadataLink).toBe(SONG.link);
    expect(result.current.metadata.trackTitle).toBe("Diaraby");
  });

  it("keeps playing when the Song object changes but its link does not", async () => {
    const { result, rerender, spotify } = await renderPlayer(SONG);

    act(() => spotify.emitReady());
    act(() => spotify.emitPlayback({ position: 2000 }));
    expect(result.current.songPlaying).toBe(true);

    // What the reducer hands back once oEmbed metadata is merged onto the round's
    // Song: a new object for the same track. Nothing about the embed has changed,
    // so nothing may be reloaded — a reload drops the player back to Loading and
    // stops the music mid-clip.
    rerender({ song: { ...SONG, trackTitle: "Diaraby" } });

    expect(spotify.controller.loadUri).not.toHaveBeenCalled();
    expect(result.current.songReady).toBe(true);
    expect(result.current.songPlaying).toBe(true);
  });

  it("loads the new track when the link changes", async () => {
    const { rerender, spotify } = await renderPlayer(SONG);

    act(() => spotify.emitReady());
    rerender({
      song: { ...SONG, link: "https://open.spotify.com/track/def456" },
    });

    expect(spotify.controller.loadUri).toHaveBeenCalledWith(
      "spotify:track:def456",
    );
    await settle();
  });
});
