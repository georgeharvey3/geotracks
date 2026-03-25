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
}

export interface Guess {
  country: string;
  correct: boolean;
  distance?: number;
  direction?: string;
}

export interface ScoreEntry {
  name: string;
  score: number;
}

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface GameModes {
  infinite: string;
  competition: string;
}
