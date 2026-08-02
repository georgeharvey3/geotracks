import { describe, it, expect } from "vitest";

import {
  cleanTrackUrl,
  communityAlbumFrom,
  heldTrack,
  nextDay,
} from "./acceptance";
import type { Album, CommunityAlbum } from "../types";

const track = (id: string) => `https://open.spotify.com/track/${id}`;

const album = (name: string, tracks: string[]): Album => ({
  country: "Taiwan",
  album_name: name,
  tracks,
});

describe("nextDay", () => {
  it("is the day after the one it is given", () => {
    expect(nextDay(new Date("2026-08-02T09:00:00"))).toBe("2026-08-03");
  });

  it("rolls over a month, and a year", () => {
    expect(nextDay(new Date("2026-08-31T23:59:00"))).toBe("2026-09-01");
    expect(nextDay(new Date("2026-12-31T12:00:00"))).toBe("2027-01-01");
  });

  it("pads to YYYY-MM-DD, which is what makes the date comparison a string one", () => {
    // `competitionAlbums` compares `liveFrom` lexicographically, so a
    // single-digit month would sort after every padded one.
    expect(nextDay(new Date("2026-01-08T00:00:00"))).toBe("2026-01-09");
  });
});

describe("cleanTrackUrl", () => {
  it("cuts a share token off", () => {
    expect(cleanTrackUrl(`${track("abc")}?si=deadbeef`)).toBe(track("abc"));
  });

  it("leaves a bare URL — the form the whole Library is already in — alone", () => {
    expect(cleanTrackUrl(track("abc"))).toBe(track("abc"));
  });
});

describe("heldTrack", () => {
  const library = [
    album("Songs of the Amis", [track("aaa"), track("bbb")]),
    album("Bunun Polyphony", [track("ccc")]),
  ];

  it("finds nothing in an album the Library does not hold", () => {
    expect(heldTrack([track("zzz")], library)).toBeNull();
  });

  it("names the album a repeated track is already in", () => {
    // One track is enough: the same record submitted twice under two names is
    // exactly what this is for, so the album's own title proves nothing.
    expect(heldTrack([track("zzz"), track("ccc")], library)).toEqual({
      track: track("ccc"),
      albumName: "Bunun Polyphony",
    });
  });

  it("looks across both halves of the Library", () => {
    const live: CommunityAlbum = {
      country: "Mali",
      album_name: "Accepted last week",
      tracks: [track("ddd")],
      liveFrom: "2026-07-01",
    };

    expect(heldTrack([track("ddd")], [...library, live])).toEqual({
      track: track("ddd"),
      albumName: "Accepted last week",
    });
  });
});

describe("communityAlbumFrom", () => {
  it("writes the country name, because the Library joins by name", () => {
    expect(
      communityAlbumFrom({
        country: "Taiwan",
        albumName: "Aboriginal Folk Songs",
        tracks: [track("aaa")],
        liveFrom: "2026-08-03",
        suggestion: "-Oz0Maolcc3TKkMg4QHd",
      }),
    ).toEqual({
      country: "Taiwan",
      album_name: "Aboriginal Folk Songs",
      tracks: [track("aaa")],
      liveFrom: "2026-08-03",
      suggestion: "-Oz0Maolcc3TKkMg4QHd",
    });
  });

  it("leaves the key out entirely for an album nobody suggested", () => {
    // Not `suggestion: undefined`: RTDB rejects an explicit undefined in a
    // write, and the `.validate` rule allows no key it does not name.
    const entry = communityAlbumFrom({
      country: "Mali",
      albumName: "Added by hand",
      tracks: [track("bbb")],
      liveFrom: "2026-08-03",
    });

    expect("suggestion" in entry).toBe(false);
  });
});
