import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import useSpotifyPlayer from "./useSpotifyPlayer";
import { forgetIFrameApi } from "../spotify/iframeApi";
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

/**
 * The same API, but answering when the test says so and handing out a fresh
 * controller each time — which is what the real one does, and the only way to
 * have two creations in flight at once.
 */
function deferredIFrameApi() {
  const created: {
    controller: SpotifyEmbedController;
    deliver: () => void;
    emitReady: () => void;
  }[] = [];

  const api: SpotifyIFrameAPI = {
    createController: vi.fn((element, _options, callback) => {
      const readyListeners: (() => void)[] = [];
      const controller: SpotifyEmbedController = {
        togglePlay: vi.fn(),
        seek: vi.fn(),
        loadUri: vi.fn(),
        destroy: vi.fn(),
        addListener: ((event: string, listener: never) => {
          if (event === "ready") readyListeners.push(listener);
        }) as SpotifyEmbedController["addListener"],
      };
      // The real API draws its iframe into the element it was handed, which is
      // what tearing the embed down takes away again.
      element.appendChild(document.createElement("iframe"));
      created.push({
        controller,
        deliver: () => callback(controller),
        emitReady: () => readyListeners.forEach((listener) => listener()),
      });
    }),
  };

  return { api, created };
}

// The hook's own load watchdog and retry budget, which these tests outlast.
const LOAD_TIMEOUT_MS = 10000;
const MAX_AUTO_RETRIES = 3;

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
    // A page that has not yet heard from the API script. The handshake is
    // page-level and outlives any one player, so it is what has to be reset
    // between tests rather than the global the script calls.
    forgetIFrameApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve(METADATA) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.spotifyIFrameApi;
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

  // The three ways the announcement and a player can miss each other. All of
  // them ended the same way before the handshake became the page's: no
  // controller, a Clip stuck on its spinner, and a play button that does
  // nothing. See `src/spotify/iframeApi.ts`.

  it("loads when the API script landed before the player was on screen", async () => {
    const spotify = fakeIFrameApi();
    // The script finishes while the player is still on the menu — which is
    // where Competition holds them until the live Library arrives.
    act(() => window.onSpotifyIframeApiReady!(spotify.api));

    const rendered = renderHook(() => useSpotifyPlayer(SONG, OPTIONS));
    act(() => rendered.result.current.embedRef(document.createElement("div")));
    await settle();

    expect(spotify.api.createController).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uri: "spotify:track:abc123" }),
      expect.any(Function),
    );

    act(() => spotify.emitReady());
    expect(rendered.result.current.songReady).toBe(true);
  });

  it("loads on a second game screen in the same session", async () => {
    const first = await renderPlayer(SONG);
    act(() => first.spotify.emitReady());
    first.unmount();

    // The API is announced once per page, so the next player is only ever going
    // to hear about it second-hand.
    const second = renderHook(() => useSpotifyPlayer(SONG, OPTIONS));
    act(() => second.result.current.embedRef(document.createElement("div")));
    await settle();

    expect(first.spotify.api.createController).toHaveBeenCalledTimes(2);
  });

  it("does not spend its retries while the page waits for the API script", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const rendered = renderHook(() => useSpotifyPlayer(SONG, OPTIONS));
    act(() => rendered.result.current.embedRef(document.createElement("div")));
    await settle();

    // Long enough for every retry, on a script that is simply slow. There is no
    // embed yet, so there is nothing for the watchdog to be watching.
    act(() => vi.advanceTimersByTime(LOAD_TIMEOUT_MS * (MAX_AUTO_RETRIES + 2)));
    expect(rendered.result.current.songLoadFailed).toBe(false);

    const spotify = fakeIFrameApi();
    act(() => window.onSpotifyIframeApiReady!(spotify.api));
    expect(spotify.api.createController).toHaveBeenCalledTimes(1);

    act(() => spotify.emitReady());
    expect(rendered.result.current.songReady).toBe(true);

    vi.useRealTimers();
  });

  it("plays through the controller its embed actually holds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const spotify = deferredIFrameApi();
    act(() => window.onSpotifyIframeApiReady!(spotify.api));

    const rendered = renderHook(() => useSpotifyPlayer(SONG, OPTIONS));
    act(() => rendered.result.current.embedRef(document.createElement("div")));
    await settle();

    // The embed is slow enough that the load times out and is retried while the
    // first controller is still being built.
    act(() => vi.advanceTimersByTime(LOAD_TIMEOUT_MS));
    expect(spotify.created).toHaveLength(2);

    // Both answer, and in the order that hurts: the superseded one last.
    act(() => spotify.created[1]!.deliver());
    act(() => spotify.created[0]!.deliver());

    const live = spotify.created[1]!;
    const superseded = spotify.created[0]!;
    act(() => live.emitReady());
    expect(rendered.result.current.songReady).toBe(true);

    act(() => rendered.result.current.onPlayClicked());
    expect(live.controller.togglePlay).toHaveBeenCalled();
    expect(superseded.controller.togglePlay).not.toHaveBeenCalled();
    // And it was not left running in the background either.
    expect(superseded.controller.destroy).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
