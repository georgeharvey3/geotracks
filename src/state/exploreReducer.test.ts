import { describe, it, expect } from "vitest";
import {
  createInitialExploreState,
  currentSong,
  exploreReducer,
  ExploreState,
} from "./exploreReducer";
import { Album } from "../types";

// A country's queue is shuffled, so no test may say which Song comes first.
// Every property below holds under any shuffle.
const albums: Album[] = [
  { country: "Mali", album_name: "Mali One", tracks: ["m1", "m2"] },
  { country: "Mali", album_name: "Mali Two", tracks: ["m3"] },
  { country: "Vanuatu", album_name: "Vanuatu One", tracks: ["v1", "v2"] },
];

const MALI_SONGS = 3;

const initial = () => createInitialExploreState(albums);
const select = (state: ExploreState, country: string) =>
  exploreReducer(state, { type: "SELECT_COUNTRY", country });
const skip = (state: ExploreState) => exploreReducer(state, { type: "SKIP" });
const leave = (state: ExploreState) => exploreReducer(state, { type: "LEAVE" });
const askAbout = (state: ExploreState, country: string) =>
  exploreReducer(state, { type: "ASK_ABOUT", country });

const linkOf = (state: ExploreState) => currentSong(state)?.link;

/** The links heard from `state` onwards, taking `count` Songs in all. */
function listen(state: ExploreState, count: number): string[] {
  const heard: string[] = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    heard.push(linkOf(current)!);
    current = skip(current);
  }
  return heard;
}

describe("exploreReducer", () => {
  describe("playable countries", () => {
    it("offers every country the app holds an album for, and no others", () => {
      expect(initial().playableCountries).toEqual(["Mali", "Vanuatu"]);
    });

    it("has nothing playing until a country is chosen", () => {
      expect(currentSong(initial())).toBeUndefined();
    });
  });

  describe("choosing a country", () => {
    it("yields a Song from the country chosen", () => {
      const state = select(initial(), "Mali");

      expect(currentSong(state)?.country).toBe("Mali");
    });

    it("ignores a country the app holds no music for", () => {
      const state = initial();

      expect(select(state, "Antarctica")).toBe(state);
    });

    it("does nothing when the country chosen is already playing", () => {
      const state = select(initial(), "Mali");

      expect(select(state, "Mali")).toBe(state);
    });

    it("switches countries without disturbing the one left behind", () => {
      const mali = select(initial(), "Mali");
      const wasPlaying = linkOf(mali);

      const vanuatu = select(mali, "Vanuatu");
      expect(currentSong(vanuatu)?.country).toBe("Vanuatu");

      expect(linkOf(select(vanuatu, "Mali"))).toBe(wasPlaying);
    });
  });

  describe("skipping", () => {
    it("yields a Song not yet heard", () => {
      const state = select(initial(), "Mali");
      const first = linkOf(state);

      expect(linkOf(skip(state))).not.toBe(first);
    });

    it("does nothing before a country is chosen", () => {
      const state = initial();

      expect(skip(state)).toBe(state);
    });

    it("plays every Song a country has exactly once before any repeats", () => {
      const heard = listen(select(initial(), "Mali"), MALI_SONGS);

      expect(new Set(heard).size).toBe(MALI_SONGS);
      expect(heard).toHaveLength(MALI_SONGS);
    });

    it("carries on rather than stopping once a country is exhausted", () => {
      let state = select(initial(), "Mali");
      const heard = listen(state, MALI_SONGS);
      for (let i = 0; i < MALI_SONGS; i += 1) state = skip(state);

      // Past the end of the queue there is still something playing, and it is
      // necessarily one the player has heard before.
      expect(linkOf(state)).toBeDefined();
      expect(heard).toContain(linkOf(state));
    });

    it("does not repeat the Song just heard when the queue is drawn afresh", () => {
      let state = select(initial(), "Mali");
      for (let i = 0; i < MALI_SONGS - 1; i += 1) state = skip(state);
      const last = linkOf(state);

      expect(linkOf(skip(state))).not.toBe(last);
    });
  });

  describe("returning to a country", () => {
    it("resumes where the player left off rather than restarting", () => {
      const mali = skip(skip(select(initial(), "Mali")));
      const resumed = select(select(mali, "Vanuatu"), "Mali");

      expect(linkOf(resumed)).toBe(linkOf(mali));
    });

    it("keeps going forward from there, not from the start", () => {
      const first = select(initial(), "Mali");
      const second = skip(first);
      const resumed = select(select(second, "Vanuatu"), "Mali");
      const third = skip(resumed);

      // Three Songs from a three-Song country, all different: the detour
      // through Vanuatu did not rewind Mali's queue.
      const heard = [linkOf(first), linkOf(second), linkOf(third)];
      expect(new Set(heard).size).toBe(MALI_SONGS);
    });
  });

  describe("asking about a country with no music", () => {
    it("picks it, without playing anything", () => {
      const asked = askAbout(initial(), "Belgium");

      expect(asked.askedAbout).toBe("Belgium");
      expect(asked.country).toBeNull();
      expect(currentSong(asked)).toBeUndefined();
    });

    // The point of the whole arrangement: the question costs nothing.
    it("leaves the Song in flight exactly where it was", () => {
      const mali = select(initial(), "Mali");
      const asked = askAbout(mali, "Belgium");

      expect(asked.country).toBe("Mali");
      expect(linkOf(asked)).toBe(linkOf(mali));
    });

    it("has nothing to ask about a country the app holds music for", () => {
      const state = initial();

      expect(askAbout(state, "Mali")).toBe(state);
    });

    it("drops the question once a country is chosen to listen to", () => {
      const asked = askAbout(initial(), "Belgium");

      expect(select(asked, "Mali").askedAbout).toBeNull();
    });
  });

  describe("leaving", () => {
    it("leaves nothing playing", () => {
      const left = leave(select(initial(), "Mali"));

      expect(left.country).toBeNull();
      expect(currentSong(left)).toBeUndefined();
    });

    it("keeps the country's place for when it is chosen again", () => {
      const mali = skip(select(initial(), "Mali"));
      const returned = select(leave(mali), "Mali");

      expect(linkOf(returned)).toBe(linkOf(mali));
    });

    it("takes the question with it, so a return opens on a clean map", () => {
      expect(leave(askAbout(initial(), "Belgium")).askedAbout).toBeNull();
    });

    it("does nothing when nothing was playing", () => {
      const state = initial();

      expect(leave(state)).toBe(state);
    });
  });
});
