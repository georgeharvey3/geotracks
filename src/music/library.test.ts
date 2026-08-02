import { describe, it, expect } from "vitest";

import albumsJSON from "../albums.json";
import { bundledAlbums, competitionAlbums, libraryWith } from "./library";
import { Album, CommunityAlbum, LibraryAlbum } from "../types";

const folkways = (name: string): Album => ({
  country: "Testland",
  album_name: name,
  tracks: [`https://open.spotify.com/track/${name}`],
});

const community = (name: string, liveFrom: string): CommunityAlbum => ({
  ...folkways(name),
  liveFrom,
});

describe("bundledAlbums", () => {
  it("is the Folkways file and nothing else", () => {
    // The half that ships. Community albums live in the database now, so
    // nothing here should ever have grown a `liveFrom`.
    expect(bundledAlbums).toEqual(albumsJSON);
    expect(bundledAlbums.some((album) => "liveFrom" in album)).toBe(false);
  });
});

describe("libraryWith", () => {
  it("is the bundled albums, then the live ones", () => {
    const live = community("live", "2026-01-01");
    const merged = libraryWith([live]);

    expect(merged).toHaveLength(bundledAlbums.length + 1);
    expect(merged[merged.length - 1]).toBe(live);
  });

  it("keeps the bundled albums first and in order, so the seed does not move", () => {
    // The daily seed draws *by index* into this array. Two players are owed the
    // same albums in the same sequence, so where the live half is spliced in is
    // a correctness property rather than a tidiness one.
    expect(libraryWith([community("live", "2026-01-01")]).slice(0, 3)).toEqual(
      bundledAlbums.slice(0, 3),
    );
  });

  it("is exactly the bundled half when nothing is live", () => {
    expect(libraryWith([])).toEqual(bundledAlbums);
  });
});

describe("competitionAlbums", () => {
  const today = "2026-08-01";

  it("keeps every bundled album — they carry no liveFrom and are always live", () => {
    const albums: LibraryAlbum[] = [folkways("a"), folkways("b")];
    expect(competitionAlbums(albums, today)).toEqual(albums);
  });

  it("lets a Community album in once the day has passed its liveFrom", () => {
    const yesterday = community("yesterday", "2026-07-31");
    expect(competitionAlbums([yesterday], today)).toEqual([yesterday]);
  });

  it("holds a Community album back on its own liveFrom", () => {
    // The boundary the whole field exists for: a day's Daily Songs must not
    // change under a player part-way through it, so the album waits out the
    // whole of the date it names and arrives at the next local midnight.
    expect(competitionAlbums([community("today", today)], today)).toEqual([]);
  });

  it("holds a Community album back before its liveFrom", () => {
    expect(
      competitionAlbums([community("tomorrow", "2026-08-02")], today),
    ).toEqual([]);
  });

  it("filters without disturbing the order of what is left", () => {
    const first = folkways("first");
    const held = community("held", "2026-08-02");
    const live = community("live", "2026-07-01");
    const last = folkways("last");

    expect(competitionAlbums([first, held, live, last], today)).toEqual([
      first,
      live,
      last,
    ]);
  });

  it("gives the same pool whether an album is held back or absent", () => {
    // What makes a live Library safe to seed from: an album before its
    // `liveFrom` is indistinguishable from one that has not been accepted yet,
    // so a player who loads before it is accepted and a player who loads after
    // are drawing from the same array.
    const bundled = [folkways("a"), folkways("b")];
    const held = community("held", "2026-08-02");

    expect(competitionAlbums(libraryWith([]), today)).toEqual(
      competitionAlbums(libraryWith([held]), today),
    );
    expect(competitionAlbums([...bundled, held], today)).toEqual(bundled);
  });
});
