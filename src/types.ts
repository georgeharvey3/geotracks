export interface Album {
  country: string;
  album_name: string;
  tracks: string[];
}

export interface Country {
  code: string;
  name: string;
  lat: string;
  lon: string;
}

export interface Song {
  country: string;
  link: string;
  album: string;
  trackTitle?: string;
  artistName?: string;
  thumbnailUrl?: string;
}

/** What the Spotify oEmbed API tells us about a Song. */
export interface SongMetadata {
  trackTitle?: string;
  artistName?: string;
  thumbnailUrl?: string;
}

/**
 * How a turn ended: the answer named on the first attempt, named on a later
 * attempt, or missed. The one distinction the Run summary's rows and its map
 * marking are both drawn in.
 */
export type TurnOutcome = "named-first" | "named-later" | "missed";

/**
 * What a Run keeps about one finished turn. The turn's individual Guesses are
 * deliberately absent — how the player got there stops mattering once the turn
 * is over, and the Run summary is a picture of where the music came from rather
 * than a trace of mistakes.
 */
export interface TurnResult {
  /** The Song as it was heard, metadata included where the oEmbed fetch landed. */
  song: Song;
  outcome: TurnOutcome;
  /** Guesses used on this turn: 1–5. */
  attempts: number;
  /** Points the turn contributed, already halved if geo-hints were on. */
  points: number;
  geoHintsUsed: boolean;
}

export interface Guess {
  country: string;
  correct: boolean;
  distance?: number;
  direction?: string;
}

export interface ScoreEntry {
  // Firebase push ID of the record; used as the stable React key. Optional so
  // presentational tests can supply plain `{ name, score }` fixtures.
  id?: string;
  name: string;
  score: number;
  // Server-set epoch millis when the score was submitted (backfilled for
  // records migrated from the legacy name-keyed shape).
  createdAt?: number;
}

export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface GameModes {
  infinite: string;
  competition: string;
}
