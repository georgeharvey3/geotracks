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
  isConfident,
  serialiseLibrary,
  // Vitest owns the bare name in this file.
  describe as describeCandidate,
} from "./catalogue.mjs";
import { albumIdFrom } from "./spotify.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

describe("isConfident", () => {
  const candidate = (over = {}) => ({
    score: 1,
    labelMatches: true,
    yearMatches: true,
    ...over,
  });

  it("accepts a perfect, unrivalled, corroborated match", () => {
    expect(isConfident([candidate()])).toBe(true);
  });

  // The bug this whole gate had on its first run: search returns simplified
  // album objects with no `label`, so every candidate looked unlabelled and
  // nothing was ever accepted. The year has to be able to carry it alone —
  // Spotify also marks `label` deprecated.
  it("accepts on the year alone when the label is absent", () => {
    expect(isConfident([candidate({ labelMatches: false })])).toBe(true);
  });

  it("accepts on the label alone when the title carries no year", () => {
    expect(isConfident([candidate({ yearMatches: false })])).toBe(true);
  });

  it("refuses a match with no corroboration at all", () => {
    expect(
      isConfident([candidate({ labelMatches: false, yearMatches: false })]),
    ).toBe(false);
  });

  it("refuses a match a rival scores as well as", () => {
    expect(isConfident([candidate(), candidate({ score: 0.99 })])).toBe(false);
  });

  it("accepts when the rival is clearly behind", () => {
    expect(isConfident([candidate(), candidate({ score: 0.8 })])).toBe(true);
  });

  it("refuses a loose title however well corroborated", () => {
    expect(isConfident([candidate({ score: 0.85 })])).toBe(false);
  });

  it("refuses when there is nothing to judge", () => {
    expect(isConfident([])).toBe(false);
  });
});

describe("describe", () => {
  it("ticks the signals that corroborate, and names the ones that don't", () => {
    expect(
      describeCandidate({
        score: 1,
        label: "Smithsonian Folkways Recordings",
        labelMatches: true,
        releaseYear: 2007,
        yearMatches: true,
        totalTracks: 11,
      }),
    ).toBe("1.00 · Smithsonian Folkways Recordings ✓ · 2007 ✓ · 11 tracks");
  });

  it("says so when Spotify returned no label at all", () => {
    expect(
      describeCandidate({
        score: 0.76,
        label: "",
        labelMatches: false,
        releaseYear: null,
        yearMatches: false,
        totalTracks: 16,
      }),
    ).toBe("0.76 · no label · ? · 16 tracks");
  });
});

describe("albumIdFrom", () => {
  // The review prompt's most important input: when the search misses, a human
  // goes and finds the record and pastes whatever Spotify's UI gave them.
  it("reads the id out of a share link, with its tracking parameter", () => {
    expect(
      albumIdFrom(
        "https://open.spotify.com/album/63VFjCo8dPOoELNHXJLjpd?si=abc123",
      ),
    ).toBe("63VFjCo8dPOoELNHXJLjpd");
  });

  it("reads a spotify: URI and a bare id", () => {
    expect(albumIdFrom("spotify:album:63VFjCo8dPOoELNHXJLjpd")).toBe(
      "63VFjCo8dPOoELNHXJLjpd",
    );
    expect(albumIdFrom("  63VFjCo8dPOoELNHXJLjpd  ")).toBe(
      "63VFjCo8dPOoELNHXJLjpd",
    );
  });

  // The prompt distinguishes a link from a command by this returning null, so
  // a single letter must never look like an id.
  it("is null for the prompt's own commands and for junk", () => {
    for (const input of ["r", "s", "q", "1", "", "not a link"]) {
      expect(albumIdFrom(input)).toBeNull();
    }
  });

  it("is null for a track link, which is not an album", () => {
    expect(
      albumIdFrom("https://open.spotify.com/track/0EnhV8BpUTfsNYmHg5ayzi"),
    ).toBeNull();
  });
});
