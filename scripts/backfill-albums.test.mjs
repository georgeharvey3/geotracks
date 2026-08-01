// Unit tests for the parts of the Folkways backfill that fail *quietly*.
//
// The script's own output makes a bad API call or a missing credential obvious.
// These two don't announce themselves: a serialiser that doesn't round-trip
// rewrites 30 untouched album titles and buries the real diff, and a matcher
// that scores loosely picks the wrong volume of a 20-volume series and puts one
// country's music behind another country's flag.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalise,
  yearOf,
  similarity,
  isArchiveLabel,
  rank,
  serialiseLibrary,
} from "./backfill-albums.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("serialiseLibrary", () => {
  it("round-trips the committed albums.json byte for byte", () => {
    const original = readFileSync(join(repoRoot, "src", "albums.json"), "utf8");
    expect(serialiseLibrary(JSON.parse(original))).toBe(original);
  });

  it("escapes non-ASCII rather than emitting it literally", () => {
    const out = serialiseLibrary([{ country: "Peru", album_name: "Corazón" }]);
    expect(out).toContain("Coraz\\u00f3n");
    expect(out).not.toContain("Corazón");
  });
});

describe("normalise", () => {
  it("strips the trailing year, diacritics, case and punctuation", () => {
    expect(normalise("Egypt: Taqâsîm & Layâlî - Cairo Tradition (1971)")).toBe(
      "egypt taqasim and layali cairo tradition",
    );
  });

  it("leaves a year that is part of the title itself", () => {
    expect(normalise("Sextetos Cubanos: Sones 1930 (1991)")).toBe(
      "sextetos cubanos sones 1930",
    );
  });
});

describe("yearOf", () => {
  it("reads the release year out of the trailing parenthesis", () => {
    expect(yearOf("Folk Music of Liberia (1954)")).toBe(1954);
  });

  it("reads the last year of a multi-year parenthesis", () => {
    expect(yearOf("Cajun Social Music (1990, 1977)")).toBe(1977);
  });

  it("is null when the title carries no year", () => {
    expect(yearOf("Moussolou")).toBeNull();
  });
});

describe("similarity", () => {
  it("is 1 for identical strings", () => {
    expect(similarity("music of mali", "music of mali")).toBe(1);
  });

  // The whole reason the matcher is conservative: this series runs to Vol. 20,
  // and the volume number is the only thing telling two titles apart.
  it("separates adjacent volumes of the same series", () => {
    const thirteen = normalise(
      "Music of Indonesia, Vol. 13: Kalimantan Strings (1997)",
    );
    const fourteen = normalise(
      "Music of Indonesia, Vol. 14: Lombok, Kalimantan, Banyumas (1997)",
    );
    expect(similarity(thirteen, fourteen)).toBeLessThan(0.9);
  });

  it("tolerates diacritic and punctuation drift", () => {
    const sheet = normalise("Côte d'Ivoire: Baule Vocal Music (1972)");
    const spotify = normalise("Cote dIvoire - Baule Vocal Music");
    expect(similarity(sheet, spotify)).toBeGreaterThan(0.9);
  });
});

describe("isArchiveLabel", () => {
  it("recognises the imprints the Smithsonian absorbed", () => {
    expect(isArchiveLabel("Smithsonian Folkways Recordings")).toBe(true);
    expect(isArchiveLabel("Arhoolie Records")).toBe(true);
    expect(isArchiveLabel("UNESCO Collection")).toBe(true);
  });

  it("rejects an unrelated label reissuing the same title", () => {
    expect(isArchiveLabel("Putumayo World Music")).toBe(false);
    expect(isArchiveLabel("")).toBe(false);
  });
});

describe("rank", () => {
  const candidates = [
    {
      id: "wrong",
      name: "Music of Indonesia, Vol. 14: Lombok, Kalimantan, Banyumas",
      label: "Smithsonian Folkways Recordings",
      release_date: "1997-01-01",
      total_tracks: 12,
    },
    {
      id: "right",
      name: "Music of Indonesia, Vol. 13: Kalimantan Strings",
      label: "Smithsonian Folkways Recordings",
      release_date: "1997-01-01",
      total_tracks: 10,
    },
  ];

  it("puts the matching volume first despite the shared prefix", () => {
    const ranked = rank(
      "Music of Indonesia, Vol. 13: Kalimantan Strings (1997)",
      candidates,
    );
    expect(ranked[0].id).toBe("right");
  });

  it("reports the corroborating evidence alongside the score", () => {
    const [best] = rank(
      "Music of Indonesia, Vol. 13: Kalimantan Strings (1997)",
      candidates,
    );
    expect(best.labelMatches).toBe(true);
    expect(best.yearMatches).toBe(true);
    expect(best.releaseYear).toBe(1997);
  });

  it("marks a same-titled record on an unrelated label as uncorroborated", () => {
    const [best] = rank("Folk Music of Albania (2006)", [
      {
        id: "reissue",
        name: "Folk Music of Albania",
        label: "Some Other Records",
        release_date: "2019-05-01",
        total_tracks: 8,
      },
    ]);
    expect(best.score).toBeGreaterThan(0.9);
    expect(best.labelMatches).toBe(false);
    expect(best.yearMatches).toBe(false);
  });
});
