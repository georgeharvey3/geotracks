import { bundledAlbums } from "../music/library";
import { LibraryAlbum, Song } from "../types";

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
  /**
   * The country being *asked about*: one the app holds no music for, that the
   * player has picked in order to say so. Explore's second kind of selection,
   * and deliberately not the first — nothing plays, nothing stops, and nothing
   * about the listening in flight changes.
   */
  askedAbout: string | null;
  /** Queue position per country visited, so returning resumes. */
  queues: Record<string, CountryQueue>;
}

export type ExploreAction =
  // The live half of the Library, arriving after the screen already exists.
  | { type: "ALBUMS_LOADED"; albums: LibraryAlbum[] }
  | { type: "SELECT_COUNTRY"; country: string }
  | { type: "ASK_ABOUT"; country: string }
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
  albums: LibraryAlbum[] = bundledAlbums,
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
    askedAbout: null,
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
    // A country whose music arrives late simply becomes Playable. Queues are
    // built per country on first selection, so a country nobody has chosen yet
    // has nothing to reconcile — and one already being listened to keeps the
    // queue it has, since a queue that grew mid-Song would change what comes
    // next under the listener.
    case "ALBUMS_LOADED": {
      const songsByCountry = { ...state.songsByCountry };
      const playableCountries = [...state.playableCountries];

      for (const album of action.albums) {
        const songs = album.tracks.map((link) => ({
          country: album.country,
          link,
          album: album.album_name,
        }));
        const held = songsByCountry[album.country];
        if (held === undefined) {
          songsByCountry[album.country] = songs;
          playableCountries.push(album.country);
        } else {
          songsByCountry[album.country] = [...held, ...songs];
        }
      }

      return { ...state, songsByCountry, playableCountries };
    }

    case "SELECT_COUNTRY": {
      const { country } = action;
      const songs = state.songsByCountry[country];
      // Non-playable, or the country already playing: a stray click while
      // panning must not interrupt the music.
      if (songs === undefined || country === state.country) return state;

      // Listening to somewhere is answer enough to the question the offer was
      // asking, so the offer goes with it.
      const chosen = { ...state, country, askedAbout: null };

      // A country visited before resumes where it was left, rather than
      // replaying what the player has already heard.
      if (state.queues[country] !== undefined) return chosen;

      return {
        ...chosen,
        queues: { ...state.queues, [country]: drawQueue(songs) },
      };
    }

    /**
     * A country with no music, picked. The moment a person most wants to
     * suggest an album is here, not on the menu — the menu is the one place in
     * the app where nobody is thinking about a specific country.
     *
     * **This deliberately does not navigate.** Explore commits on a single tap
     * (`armOnTouch={false}`), because choosing a country costs nothing but the
     * Song now playing; if a silent country left for the Suggestion form, one
     * stray tap on Chad while listening to Mali would unmount the player and
     * cost both the music and the screen. So the map's click only tells the
     * panel, and going to the form is a second, deliberate action — the same
     * arm-then-commit shape the touch rule already uses, applied to the thing
     * that has now acquired a cost.
     */
    case "ASK_ABOUT": {
      const { country } = action;
      // A country we hold music for is chosen, never asked about.
      if (state.songsByCountry[country] !== undefined) return state;
      return state.askedAbout === country
        ? state
        : { ...state, askedAbout: country };
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
      return state.country === null && state.askedAbout === null
        ? state
        : { ...state, country: null, askedAbout: null };

    default:
      return state;
  }
}
