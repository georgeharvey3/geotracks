import { describe, it, expect } from "vitest";
import {
  DAILY_RUN_VERSION,
  DailyRunRecord,
  dayString,
  isRecordForDay,
  parseDailyRun,
  serializeDailyRun,
} from "./dailyRun";
import { TurnResult } from "../types";

const turn: TurnResult = {
  song: {
    country: "Mali",
    link: "https://open.spotify.com/track/abc",
    album: "Kar Kar",
    trackTitle: "Kar Kar",
    artistName: "Boubacar Traoré",
    thumbnailUrl: "https://i.scdn.co/image/abc",
  },
  outcome: "named-first",
  attempts: 1,
  points: 150,
  geoHintsUsed: false,
};

const record: DailyRunRecord = {
  v: DAILY_RUN_VERSION,
  date: "2026-08-01",
  status: "in-progress",
  turnIndex: 1,
  score: 150,
  dailySongIndex: 2,
  scoreSubmitted: false,
  turns: [turn],
  round: {
    guesses: [
      { country: "Chad", correct: false, distance: 2100, direction: "W" },
    ],
    geoHintsEnabled: true,
    finished: false,
    correct: false,
    roundPoints: 0,
  },
};

describe("dayString", () => {
  it("reads the date's local calendar day, the same one the song seed reads", () => {
    expect(dayString(new Date(2026, 7, 1, 23, 30))).toBe("2026-08-01");
  });

  it("zero-pads month and day", () => {
    expect(dayString(new Date(2026, 0, 9, 0, 0))).toBe("2026-01-09");
  });
});

describe("isRecordForDay", () => {
  it("is the day's record when the dates match", () => {
    expect(isRecordForDay(record, "2026-08-01")).toBe(true);
  });

  it("is not the day's record for any other date, past or future", () => {
    expect(isRecordForDay(record, "2026-08-02")).toBe(false);
    expect(isRecordForDay(record, "2026-07-31")).toBe(false);
  });
});

describe("serializeDailyRun / parseDailyRun", () => {
  it("round-trips a record", () => {
    expect(parseDailyRun(serializeDailyRun(record))).toEqual(record);
  });

  it("round-trips a finished record", () => {
    const finished: DailyRunRecord = {
      ...record,
      status: "finished",
      turnIndex: 10,
      scoreSubmitted: true,
    };
    expect(parseDailyRun(serializeDailyRun(finished))).toEqual(finished);
  });

  it("keeps the Song metadata inside the turns, which no reopened summary could re-derive offline", () => {
    const parsed = parseDailyRun(serializeDailyRun(record))!;
    expect(parsed.turns[0]!.song.trackTitle).toBe("Kar Kar");
    expect(parsed.turns[0]!.song.artistName).toBe("Boubacar Traoré");
    expect(parsed.turns[0]!.song.thumbnailUrl).toBe(
      "https://i.scdn.co/image/abc",
    );
  });

  // Fail open, every time: a serialization bug of ours must not be
  // indistinguishable from a punishment.
  it("discards nothing stored", () => {
    expect(parseDailyRun(null)).toBeNull();
  });

  it("discards a record that will not parse", () => {
    expect(parseDailyRun("{not json")).toBeNull();
    expect(parseDailyRun("null")).toBeNull();
    expect(parseDailyRun('"a string"')).toBeNull();
    expect(parseDailyRun("[]")).toBeNull();
  });

  it("discards a record carrying an unrecognised version", () => {
    expect(parseDailyRun(JSON.stringify({ ...record, v: 2 }))).toBeNull();
    const { v: _v, ...versionless } = record;
    expect(parseDailyRun(JSON.stringify(versionless))).toBeNull();
  });

  it("discards a record with an unrecognised status", () => {
    expect(
      parseDailyRun(JSON.stringify({ ...record, status: "abandoned" })),
    ).toBeNull();
  });

  it("discards a record whose figures are not whole numbers", () => {
    expect(
      parseDailyRun(JSON.stringify({ ...record, turnIndex: "1" })),
    ).toBeNull();
    expect(parseDailyRun(JSON.stringify({ ...record, score: 1.5 }))).toBeNull();
    expect(
      parseDailyRun(JSON.stringify({ ...record, dailySongIndex: -1 })),
    ).toBeNull();
  });

  it("discards a record whose turns are not Turn results", () => {
    expect(parseDailyRun(JSON.stringify({ ...record, turns: {} }))).toBeNull();
    expect(
      parseDailyRun(
        JSON.stringify({ ...record, turns: [{ ...turn, outcome: "won" }] }),
      ),
    ).toBeNull();
    expect(
      parseDailyRun(
        JSON.stringify({ ...record, turns: [{ ...turn, song: undefined }] }),
      ),
    ).toBeNull();
  });

  it("discards a record whose round in flight is missing or malformed", () => {
    const { round: _round, ...roundless } = record;
    expect(parseDailyRun(JSON.stringify(roundless))).toBeNull();
    expect(
      parseDailyRun(
        JSON.stringify({ ...record, round: { ...record.round, guesses: 3 } }),
      ),
    ).toBeNull();
    expect(
      parseDailyRun(
        JSON.stringify({
          ...record,
          round: { ...record.round, guesses: [{ country: "Chad" }] },
        }),
      ),
    ).toBeNull();
  });

  it("drops fields it does not know, rather than letting them into game state", () => {
    const parsed = parseDailyRun(
      JSON.stringify({ ...record, sneaked: "in", turns: [] }),
    )!;
    expect(parsed).not.toHaveProperty("sneaked");
  });

  it("keeps a Song that never got its metadata", () => {
    const bare: DailyRunRecord = {
      ...record,
      turns: [
        {
          ...turn,
          song: { country: "Mali", link: "spotify:track", album: "Kar Kar" },
        },
      ],
    };
    expect(parseDailyRun(serializeDailyRun(bare))).toEqual(bare);
  });
});
