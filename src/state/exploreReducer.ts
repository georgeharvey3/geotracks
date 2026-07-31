import albumsJSON from "../albums.json";
import { Album, Song } from "../types";

/**
 * Where a country's listening has got to: the order its Songs are heard in, and
 * how far through that order the player is. Drawn afresh and exhausted before
 * any Song repeats.
 */
export interface CountryQueue {
  songs: Song[];
  index: number;
}

export interface ExploreState {
  /** Every Playable country's Songs, by country name. */
  songsByCountry: Record<string, Song[]>;
  /** The Playable countries, in the order `countries.json` lists them. */
  playableCountries: string[];
  /** The country being listened to; null until the player chooses one. */
  country: string | null;
  /** Queue position per country visited, so returning resumes. */
  queues: Record<string, CountryQueue>;
}

export type ExploreAction =
  | { type: "SELECT_COUNTRY"; country: string }
  | { type: "SKIP" }
  | { type: "LEAVE" };

function shuffle(songs: Song[]): Song[] {
  const shuffled = [...songs];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    // Both indices are in range, so neither read can be undefined.
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * A country's queue drawn afresh. `after` is the Song just heard: a new draw
 * that opened with it would make the skip that triggered the draw look like it
 * did nothing, so it is moved out of the way.
 */
function drawQueue(songs: Song[], after?: Song): CountryQueue {
  const drawn = shuffle(songs);
  if (
    drawn.length > 1 &&
    after !== undefined &&
    drawn[0]!.link === after.link
  ) {
    [drawn[0], drawn[1]] = [drawn[1]!, drawn[0]!];
  }
  return { songs: drawn, index: 0 };
}

export function createInitialExploreState(
  albums: Album[] = albumsJSON,
): ExploreState {
  const songsByCountry: Record<string, Song[]> = {};
  const playableCountries: string[] = [];

  for (const album of albums) {
    let songs = songsByCountry[album.country];
    if (songs === undefined) {
      songs = [];
      songsByCountry[album.country] = songs;
      playableCountries.push(album.country);
    }
    for (const link of album.tracks) {
      songs.push({ country: album.country, link, album: album.album_name });
    }
  }

  return {
    songsByCountry,
    playableCountries: playableCountries.sort((a, b) => a.localeCompare(b)),
    country: null,
    queues: {},
  };
}

/** The Song currently being listened to, if any. */
export function currentSong(state: ExploreState): Song | undefined {
  if (state.country === null) return undefined;
  const queue = state.queues[state.country];
  return queue?.songs[queue.index];
}

export function exploreReducer(
  state: ExploreState,
  action: ExploreAction,
): ExploreState {
  switch (action.type) {
    case "SELECT_COUNTRY": {
      const { country } = action;
      const songs = state.songsByCountry[country];
      // Non-playable, or the country already playing: a stray click while
      // panning must not interrupt the music.
      if (songs === undefined || country === state.country) return state;

      // A country visited before resumes where it was left, rather than
      // replaying what the player has already heard.
      if (state.queues[country] !== undefined) return { ...state, country };

      return {
        ...state,
        country,
        queues: { ...state.queues, [country]: drawQueue(songs) },
      };
    }

    case "SKIP": {
      const { country } = state;
      if (country === null) return state;
      const queue = state.queues[country];
      const songs = state.songsByCountry[country];
      if (queue === undefined || songs === undefined) return state;

      const next = queue.index + 1;
      // Every Song heard once before any repeats; then the queue is drawn
      // afresh and listening carries on, so a small country is not a cul-de-sac.
      const advanced =
        next < queue.songs.length
          ? { ...queue, index: next }
          : drawQueue(songs, queue.songs[queue.index]);

      return { ...state, queues: { ...state.queues, [country]: advanced } };
    }

    // Leaving Explore ends the listening: nothing is chosen on the way back in,
    // so a return opens on the map in silence rather than resuming mid-Song.
    // The queues are kept — they are what stops a country repeating itself, so
    // choosing that country again picks up where it left off.
    case "LEAVE":
      return state.country === null ? state : { ...state, country: null };

    default:
      return state;
  }
}
