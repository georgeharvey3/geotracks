import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import getDailySongs from "./getDailySongs";
import { Album } from "../types";

// A small, fixed album pool so the seeded selection is easy to reason about.
const ALBUMS: Album[] = Array.from({ length: 20 }, (_, i) => ({
  country: `Country ${i}`,
  album_name: `Album ${i}`,
  tracks: [
    `https://open.spotify.com/track/${i}a`,
    `https://open.spotify.com/track/${i}b`,
    `https://open.spotify.com/track/${i}c`,
  ],
}));

describe("getDailySongs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a deterministic set for a given calendar day", () => {
    vi.setSystemTime(new Date("2026-07-23T09:00:00Z"));
    const first = getDailySongs(ALBUMS);
    // A different time on the same day must not change the selection.
    vi.setSystemTime(new Date("2026-07-23T21:30:00Z"));
    const second = getDailySongs(ALBUMS);
    expect(second).toEqual(first);
  });

  it("produces a different set on a different day", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    const today = getDailySongs(ALBUMS);
    vi.setSystemTime(new Date("2026-07-24T12:00:00Z"));
    const tomorrow = getDailySongs(ALBUMS);
    expect(tomorrow).not.toEqual(today);
  });

  it("does not mutate the album pool it is given", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    const before = ALBUMS.length;
    getDailySongs(ALBUMS);
    expect(ALBUMS).toHaveLength(before);
  });

  it("never repeats an album within the daily set", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    const songs = getDailySongs(ALBUMS);
    const albumNames = songs.map((s) => s.album);
    expect(new Set(albumNames).size).toBe(songs.length);
  });

  it("honours the requested count and caps at the pool size", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getDailySongs(ALBUMS, 5)).toHaveLength(5);
    expect(getDailySongs(ALBUMS, 999)).toHaveLength(ALBUMS.length);
  });

  it("selects real tracks from the chosen albums", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    const songs = getDailySongs(ALBUMS, 3);
    songs.forEach((song) => {
      const album = ALBUMS.find((a) => a.album_name === song.album)!;
      expect(album).toBeTruthy();
      expect(album.tracks).toContain(song.link);
      expect(song.country).toBe(album.country);
    });
  });
});
