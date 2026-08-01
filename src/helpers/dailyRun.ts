import { Guess, Song, TurnOutcome, TurnResult } from "../types";

/**
 * The Daily Run's day record: what a browser profile keeps about the one
 * Competition Run it may play on a given calendar day (issue #1, ADR-0004).
 *
 * This is a **contract with the past**. It is deliberately not a snapshot of
 * `GameState`, which is refactored freely: every field here is named, mapped
 * explicitly, and versioned, so a rename in the reducer cannot silently
 * invalidate the record on every device holding yesterday's day.
 *
 * The module is pure — it takes the date as an argument and never reads the
 * clock or `window`. `useDailyRun` is the only thing that touches storage.
 */
export const DAILY_RUN_VERSION = 1;

/** The round in flight, so a reload cannot buy back a fresh first attempt. */
export interface DailyRunRound {
  guesses: Guess[];
  geoHintsEnabled: boolean;
  finished: boolean;
  correct: boolean;
  roundPoints: number;
}

export type DailyRunStatus = "in-progress" | "finished";

export interface DailyRunRecord {
  v: typeof DAILY_RUN_VERSION;
  /** The device-local calendar day, `YYYY-MM-DD` — the seed's day, not UTC's. */
  date: string;
  status: DailyRunStatus;
  turnIndex: number;
  score: number;
  dailySongIndex: number;
  /**
   * Load-bearing: without it, reopening a finished summary offers the name box
   * again and puts one score onto the append-only leaderboard repeatedly.
   */
  scoreSubmitted: boolean;
  turns: TurnResult[];
  round: DailyRunRound;
}

/**
 * The date's device-local calendar day. `getDateSeed()` reads local
 * year/month/day, so the day the Songs change is the day the Run rolls over.
 */
export function dayString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Whether the record belongs to the given day. Any mismatch unlocks, including
 * a stored date in the future: refusing to unlock until the stored date is
 * strictly past would brick the mode for anyone whose clock was briefly wrong.
 */
export function isRecordForDay(record: DailyRunRecord, day: string): boolean {
  return record.date === day;
}

export function serializeDailyRun(record: DailyRunRecord): string {
  return JSON.stringify(record);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isText = (value: unknown): value is string => typeof value === "string";

const isOptionalText = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const OUTCOMES: TurnOutcome[] = ["named-first", "named-later", "missed"];

function parseSong(value: unknown): Song | null {
  if (!isObject(value)) return null;
  if (!isText(value.country) || !isText(value.link) || !isText(value.album)) {
    return null;
  }
  if (
    !isOptionalText(value.trackTitle) ||
    !isOptionalText(value.artistName) ||
    !isOptionalText(value.thumbnailUrl)
  ) {
    return null;
  }

  const song: Song = {
    country: value.country,
    link: value.link,
    album: value.album,
  };
  // Fetched from oEmbed at play time and kept, derived-looking though it is:
  // drop it and every reopened summary reads "Unknown Track" until ten network
  // calls land, and never recovers offline.
  if (value.trackTitle !== undefined) song.trackTitle = value.trackTitle;
  if (value.artistName !== undefined) song.artistName = value.artistName;
  if (value.thumbnailUrl !== undefined) song.thumbnailUrl = value.thumbnailUrl;
  return song;
}

function parseTurn(value: unknown): TurnResult | null {
  if (!isObject(value)) return null;
  const song = parseSong(value.song);
  if (!song) return null;
  if (!OUTCOMES.includes(value.outcome as TurnOutcome)) return null;
  if (!isCount(value.attempts) || !isCount(value.points)) return null;
  if (typeof value.geoHintsUsed !== "boolean") return null;

  return {
    song,
    outcome: value.outcome as TurnOutcome,
    attempts: value.attempts,
    points: value.points,
    geoHintsUsed: value.geoHintsUsed,
  };
}

function parseGuess(value: unknown): Guess | null {
  if (!isObject(value)) return null;
  if (!isText(value.country) || typeof value.correct !== "boolean") return null;
  if (value.distance !== undefined && typeof value.distance !== "number") {
    return null;
  }
  if (!isOptionalText(value.direction)) return null;

  const guess: Guess = { country: value.country, correct: value.correct };
  if (value.distance !== undefined) guess.distance = value.distance;
  if (value.direction !== undefined) guess.direction = value.direction;
  return guess;
}

function parseRound(value: unknown): DailyRunRound | null {
  if (!isObject(value)) return null;
  if (!Array.isArray(value.guesses)) return null;

  const guesses: Guess[] = [];
  for (const raw of value.guesses) {
    const guess = parseGuess(raw);
    if (!guess) return null;
    guesses.push(guess);
  }

  if (
    typeof value.geoHintsEnabled !== "boolean" ||
    typeof value.finished !== "boolean" ||
    typeof value.correct !== "boolean" ||
    !isCount(value.roundPoints)
  ) {
    return null;
  }

  return {
    guesses,
    geoHintsEnabled: value.geoHintsEnabled,
    finished: value.finished,
    correct: value.correct,
    roundPoints: value.roundPoints,
  };
}

/**
 * The stored day, or `null` for anything we do not recognise — unparseable, an
 * unknown version, a field of the wrong shape. **Failing open is the rule**: a
 * serialization bug of ours should not be indistinguishable from a punishment,
 * and failing closed would mean one bad deploy locks the userbase out of the
 * mode with no recourse. Every field is copied across by hand, so nothing the
 * record did not declare reaches game state.
 */
export function parseDailyRun(raw: string | null): DailyRunRecord | null {
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(value)) return null;
  if (value.v !== DAILY_RUN_VERSION) return null;
  if (!isText(value.date) || value.date === "") return null;
  if (value.status !== "in-progress" && value.status !== "finished") {
    return null;
  }
  if (
    !isCount(value.turnIndex) ||
    !isCount(value.score) ||
    !isCount(value.dailySongIndex)
  ) {
    return null;
  }
  if (typeof value.scoreSubmitted !== "boolean") return null;
  if (!Array.isArray(value.turns)) return null;

  const turns: TurnResult[] = [];
  for (const raw of value.turns) {
    const turn = parseTurn(raw);
    if (!turn) return null;
    turns.push(turn);
  }

  const round = parseRound(value.round);
  if (!round) return null;

  return {
    v: DAILY_RUN_VERSION,
    date: value.date,
    status: value.status,
    turnIndex: value.turnIndex,
    score: value.score,
    dailySongIndex: value.dailySongIndex,
    scoreSubmitted: value.scoreSubmitted,
    turns,
    round,
  };
}
