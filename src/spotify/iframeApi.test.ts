import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The half of the handshake that `index.html` owns: the API script is `async`
 * and can land before this bundle has evaluated, in which case the page holds
 * the API and nobody has called us. A fresh import is the only way to be back
 * before that first evaluation.
 */
describe("the page's IFrame API handshake", () => {
  afterEach(() => {
    delete window.spotifyIFrameApi;
    delete window.onSpotifyIframeApiReady;
    vi.resetModules();
  });

  const fakeApi = (): SpotifyIFrameAPI => ({ createController: vi.fn() });

  it("takes the API index.html stashed before the bundle evaluated", async () => {
    const api = fakeApi();
    window.spotifyIFrameApi = api;

    vi.resetModules();
    const { whenIFrameApi } = await import("./iframeApi");

    const listener = vi.fn();
    whenIFrameApi(listener);
    expect(listener).toHaveBeenCalledWith(api);
  });

  it("hands the announcement to everyone waiting, and to whoever asks later", async () => {
    vi.resetModules();
    const { whenIFrameApi } = await import("./iframeApi");

    const waiting = vi.fn();
    whenIFrameApi(waiting);
    expect(waiting).not.toHaveBeenCalled();

    const api = fakeApi();
    window.onSpotifyIframeApiReady!(api);
    expect(waiting).toHaveBeenCalledWith(api);

    // The announcement is made once per page; a player mounting afterwards has
    // no second one coming.
    const late = vi.fn();
    whenIFrameApi(late);
    expect(late).toHaveBeenCalledWith(api);
  });

  it("drops a listener that gave up waiting", async () => {
    vi.resetModules();
    const { whenIFrameApi } = await import("./iframeApi");

    const listener = vi.fn();
    whenIFrameApi(listener)();
    window.onSpotifyIframeApiReady!(fakeApi());

    expect(listener).not.toHaveBeenCalled();
  });
});
