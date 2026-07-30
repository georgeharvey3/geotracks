import { useMemo } from "react";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS, OUTCOME_FILLS } from "../../map/fills";
import { countryCodeByName, countryNameByCode } from "../../map/geography";
import { TurnOutcome, TurnResult } from "../../types";

// Best outcome first: a country that answered twice is drawn as the better of
// its two turns.
const OUTCOME_ORDER: TurnOutcome[] = ["named-first", "named-later", "missed"];

interface RunSummaryMapProps {
  /** The Run's turns; only their answer countries are marked. */
  turns: TurnResult[];
  /** A row's country, lit while the pointer is on that row. */
  highlightedCountry: string | null;
}

/**
 * The Run's music drawn on the world: every answer country marked by its Turn
 * outcome, and nothing else. Wrong guesses are absent — the Run doesn't keep
 * them, and this is a picture of where the music came from rather than a trace
 * of the player's mistakes.
 *
 * Nothing here is selectable, so nothing can be committed; hover still names
 * every country, and pan/zoom come free from <BaseMap> (ADR-0003).
 *
 * The same country can answer twice in one Run — the daily seed splices out the
 * Album, not the country — so a marked shape is not a 1:1 index of a turn. The
 * rows are the record; the map is the picture, and shows the country's best
 * outcome.
 */
const RunSummaryMap = (props: RunSummaryMapProps) => {
  const outcomeByCode = useMemo(() => {
    const best = new Map<string, TurnOutcome>();
    for (const turn of props.turns) {
      const code = countryCodeByName(turn.song.country);
      if (code === undefined) continue;
      const current = best.get(code);
      if (
        current === undefined ||
        OUTCOME_ORDER.indexOf(turn.outcome) < OUTCOME_ORDER.indexOf(current)
      ) {
        best.set(code, turn.outcome);
      }
    }
    return best;
  }, [props.turns]);

  const highlightedCode =
    props.highlightedCountry === null
      ? undefined
      : countryCodeByName(props.highlightedCountry);

  const fillFor = (code: string | undefined, previewed: boolean): string => {
    if (code !== undefined && (previewed || code === highlightedCode)) {
      return MAP_FILLS.highlight;
    }
    const outcome = code === undefined ? undefined : outcomeByCode.get(code);
    if (outcome !== undefined) return OUTCOME_FILLS[outcome];
    // Everything the Run didn't visit is background: nothing here is choosable,
    // so the marked countries are the only thing that should carry colour.
    return MAP_FILLS.inertLand;
  };

  return (
    <BaseMap
      fillFor={fillFor}
      // A finished Run has nothing left to choose.
      selectable={() => false}
      labelFor={(code) => countryNameByCode(code)}
      // Nothing commits here, so there is nothing for a first tap to guard.
      armOnTouch={false}
      onCommit={() => {}}
      // The Run's answers are the only thing carrying colour here, so they are
      // also the only thing that has to survive the land underneath them.
      marked={(code) => outcomeByCode.has(code)}
      countryAttributes={(code) => ({
        "data-run-outcome": outcomeByCode.get(code),
      })}
    />
  );
};

export default RunSummaryMap;
