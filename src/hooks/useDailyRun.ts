import { useEffect, useState } from "react";

import {
  DailyRunRecord,
  DailyRunStatus,
  dayString,
  isRecordForDay,
  parseDailyRun,
  serializeDailyRun,
} from "../helpers/dailyRun";
import { dailyRunRecordFrom, GameState } from "../state/gameReducer";

/** The one key this app writes. Namespaced so it can never collide. */
export const DAILY_RUN_STORAGE_KEY = "geotracks:dailyRun";

export interface DailyRun {
  /** Today's record, or `null` when today's Run is still to play. */
  record: DailyRunRecord | null;
  /** What the menu needs: is today's Run unplayed, half-played, or done. */
  status: "none" | DailyRunStatus;
}

/**
 * The day's record and the bytes it serializes to, kept together: the bytes are
 * both the change detector and the thing written, so deriving them twice would
 * be the only way they could disagree.
 */
interface Day {
  record: DailyRunRecord | null;
  json: string | null;
}

// Storage can be unavailable outright (a private window that refuses it, a
// quota that is full). The Daily Run is a ritual, not enforcement: if it cannot
// be read or written, the player simply gets their Run.
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(DAILY_RUN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(json: string): void {
  try {
    window.localStorage.setItem(DAILY_RUN_STORAGE_KEY, json);
  } catch {
    // Nothing to recover: the Run in memory is unaffected, and the day is lost
    // only if the player leaves.
  }
}

function readDay(day: string): Day {
  const stored = parseDailyRun(readRaw());
  const record = stored && isRecordForDay(stored, day) ? stored : null;
  return { record, json: record ? serializeDailyRun(record) : null };
}

/**
 * The Daily Run's storage seam, and the only place in the app that touches
 * `localStorage` (issue #1, ADR-0004). It reads the day once on mount, follows
 * the Run as it is played, and writes the record whenever it changes — so the
 * menu can tell whether today's Competition Run is still to play, half-played,
 * or done.
 *
 * **The record is derived during render, not in an effect.** It is a pure
 * function of the Run in state, and the menu is rendered from it the moment the
 * player walks off the game screen; an effect would leave that first render
 * showing a status the Run had already moved past. The state update below is
 * the sanctioned during-render kind — it re-renders this hook's owner before
 * anything is committed — and cannot loop, because its guard is the very value
 * it sets.
 *
 * **The day is fixed at mount**, not re-read per write: a tab left open across
 * midnight would otherwise re-stamp a Run in flight with the new day, spending
 * a day on ten Songs that are no longer that day's. The record's own `date` is
 * what the next load compares against, and it unlocks on any mismatch.
 *
 * Nothing is recorded for a player who is not on a Competition Run, so the day
 * survives the walk back to the menu, an Infinite game and a visit to Explore.
 */
export default function useDailyRun(state: GameState): DailyRun {
  const [day] = useState(() => dayString(new Date()));
  const [today, setToday] = useState<Day>(() => readDay(day));

  const live = dailyRunRecordFrom(state, day);
  const liveJson = live ? serializeDailyRun(live) : null;
  if (live && liveJson !== today.json) {
    setToday({ record: live, json: liveJson });
  }

  useEffect(() => {
    // `today` only ever changes when the bytes do, so this is one write per
    // change. The exception is mount, which writes back a record it has just
    // read — the same bytes to the same key, on the one render where leaving it
    // simple costs nothing.
    if (today.json !== null) writeRaw(today.json);
  }, [today]);

  return {
    record: today.record,
    status: today.record ? today.record.status : "none",
  };
}
