import { describe, it, expect } from "vitest";

import albumsJSON from "../albums.json";
import communityAlbumsJSON from "../community-albums.json";
import { competitionAlbums, library } from "./library";
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

describe("library", () => {
  it("is both album files, and nothing else", () => {
    // Whatever `community-albums.json` holds today — it ships empty and grows
    // one accepted Suggestion at a time — the Library is exactly the union.
    expect(library).toHaveLength(
      albumsJSON.length + communityAlbumsJSON.length,
    );
    for (const album of [...albumsJSON, ...communityAlbumsJSON]) {
      expect(library).toContainEqual(album);
    }
  });

  it("keeps the Folkways albums first, so nothing about the seed moves", () => {
    expect(library.slice(0, albumsJSON.length)).toEqual(albumsJSON);
  });
});

describe("competitionAlbums", () => {
  const today = "2026-08-01";

  it("keeps every Folkways album — they carry no liveFrom and are always live", () => {
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
});
