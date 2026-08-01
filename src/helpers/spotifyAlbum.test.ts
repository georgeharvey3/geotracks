import { describe, it, expect } from "vitest";

import { extractAlbumId } from "./spotifyAlbum";

const ID = "1DFixLWuPkv3KT3TnV35m3";

describe("extractAlbumId", () => {
  it("takes the id out of a clean album URL", () => {
    expect(extractAlbumId(`https://open.spotify.com/album/${ID}`)).toEqual({
      ok: true,
      albumId: ID,
    });
  });

  it("drops the share-tracking token every Spotify link carries", () => {
    // The reason the record stores the id and not the URL: `?si=` is a
    // stranger's tracking token, and the URL is trivially rebuilt without it.
    expect(
      extractAlbumId(
        `https://open.spotify.com/album/${ID}?si=b3fa2f8e1c9d4a77&nd=1`,
      ),
    ).toEqual({ ok: true, albumId: ID });
  });

  it("accepts a localised path, a trailing slash and surrounding space", () => {
    expect(
      extractAlbumId(`  https://open.spotify.com/intl-fr/album/${ID}/  `),
    ).toEqual({ ok: true, albumId: ID });
  });

  it("accepts the spotify: URI the desktop app copies", () => {
    expect(extractAlbumId(`spotify:album:${ID}`)).toEqual({
      ok: true,
      albumId: ID,
    });
  });

  it("accepts a bare id, which is what the accept script is usually handed", () => {
    expect(extractAlbumId(ID)).toEqual({ ok: true, albumId: ID });
  });

  it("names a track link as a track link", () => {
    // The overwhelmingly likely wrong paste, and "invalid URL" would be a
    // useless thing to say about it.
    expect(
      extractAlbumId(`https://open.spotify.com/track/${ID}?si=abc`),
    ).toEqual({ ok: false, reason: "track" });
  });

  it("rejects any other kind of Spotify link", () => {
    expect(extractAlbumId(`https://open.spotify.com/playlist/${ID}`)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(extractAlbumId(`https://open.spotify.com/artist/${ID}`)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects anything that is not a Spotify album at all", () => {
    for (const input of [
      "",
      "   ",
      "not a link",
      "https://example.com/album/1DFixLWuPkv3KT3TnV35m3",
      // 21 and 23 characters: an id is exactly 22.
      "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m",
      "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m33",
      // Base62 only — no hyphens or underscores.
      "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m-",
    ]) {
      expect(extractAlbumId(input)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});
