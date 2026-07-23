import { Album, Song } from "../types";

// Mulberry32 seeded PRNG
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDateSeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export default function getDailySongs(
  albums: Album[],
  count: number = 10,
): Song[] {
  const rand = mulberry32(getDateSeed());
  const available = [...albums];
  const songs: Song[] = [];

  for (let i = 0; i < count && available.length > 0; i++) {
    const albumIndex = Math.floor(rand() * available.length);
    const album = available[albumIndex];
    const trackIndex = Math.floor(rand() * album.tracks.length);

    songs.push({
      country: album.country,
      link: album.tracks[trackIndex],
      album: album.album_name,
    });

    available.splice(albumIndex, 1);
  }

  return songs;
}
