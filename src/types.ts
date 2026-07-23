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
