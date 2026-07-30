import { useMemo } from "react";
import { Marker } from "react-simple-maps";

import BaseMap from "./BaseMap";
import getProximityColor from "../../helpers/getProximityColor";
import { MAP_FILLS } from "../../map/fills";
import {
  Coordinates,
  countryCodeByName,
  countryCoordinates,
  countryNameByCode,
} from "../../map/geography";
import { Guess } from "../../types";

// The guessing surface's own markings. `wrong` is the hints-off marking: a flat
// desaturated red, well clear of the saturated proximity-heat scale, carrying no
// distance at all.
const GUESS_FILLS = {
  wrong: "#8b4a4a",
  correct: "#4caf50",
  answer: "#ffa726",
} as const;

// Sizes of the hint furniture in screen units at zoom 1; the base map hands back
// the 1/zoom counter-scale that keeps them there.
const HINT_LABEL_SIZE = 10;
const HINT_LABEL_OFFSET = 20;

// SVG rotation is clockwise from up, which is exactly how compass bearings run,
// so the octant the geo-hint reports doubles as the arrow's angle. The arrow
// shows the same direction the text readout does — never a finer bearing.
const DIRECTION_ANGLES: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

// An arrow pointing north from the origin, rotated per guess.
const ARROW_PATH = "M0,-11 L5,-3 L2,-3 L2,6 L-2,6 L-2,-3 L-5,-3 Z";

type GuessState = "correct" | "wrong" | "answer";

/** A wrong guess re-presented on the map: where it was, and where the answer is. */
type HintMark = {
  code: string;
  coordinates: Coordinates;
  distanceKm: number;
  angle: number;
};

interface WorldMapProps {
  /** Every guess of the round, whoever committed it — map or text box. */
  guesses: Guess[];
  showGeoHints: boolean;
  /** The correct country for this round, revealed once `finished`. */
  answer: string;
  finished: boolean;
  onCommit: (countryName: string) => void;
}

/**
 * The map as the game's unified board: it marks every guess of the round
 * whichever input committed it, and reveals the answer when the round ends.
 * Everything about how a country is picked comes from <BaseMap>; this supplies
 * only what a pick means here (ADR-0003).
 */
const WorldMap = (props: WorldMapProps) => {
  const guessByCode = useMemo(() => {
    const entries = props.guesses.flatMap((guess) => {
      const code = countryCodeByName(guess.country);
      return code ? [[code, guess] as const] : [];
    });
    return new Map(entries);
  }, [props.guesses]);

  const answerCode = countryCodeByName(props.answer);
  const revealAnswer =
    props.finished && !props.guesses.some((guess) => guess.correct);

  const stateFor = (code: string): GuessState | undefined => {
    const guess = guessByCode.get(code);
    if (guess) return guess.correct ? "correct" : "wrong";
    if (revealAnswer && code === answerCode) return "answer";
    return undefined;
  };

  const fillFor = (code: string | undefined, previewed: boolean): string => {
    if (code === undefined) return MAP_FILLS.inertLand;

    switch (stateFor(code)) {
      case "correct":
        return GUESS_FILLS.correct;
      case "wrong": {
        // With hints off every wrong guess gets the same flat red, however near
        // or far it was: the map says "wrong", but may never convey proximity
        // the player opted out of.
        const distance = guessByCode.get(code)?.distance;
        return props.showGeoHints && distance !== undefined
          ? getProximityColor(distance)
          : GUESS_FILLS.wrong;
      }
      case "answer":
        return GUESS_FILLS.answer;
      default:
        // The round is over: nothing left to preview, so nothing highlights.
        if (previewed && !props.finished) return MAP_FILLS.highlight;
        return MAP_FILLS.land;
    }
  };

  const hintMarks: HintMark[] = props.showGeoHints
    ? [...guessByCode].flatMap(([code, guess]) => {
        const coordinates = countryCoordinates(code);
        const angle =
          guess.direction === undefined
            ? undefined
            : DIRECTION_ANGLES[guess.direction];
        if (guess.correct || !coordinates) return [];
        if (guess.distance === undefined || angle === undefined) return [];
        return [{ code, coordinates, distanceKm: guess.distance, angle }];
      })
    : [];

  return (
    <BaseMap
      fillFor={fillFor}
      // Once the round is over the map stops taking guesses altogether.
      selectable={() => !props.finished}
      labelFor={(code) =>
        props.finished ? undefined : countryNameByCode(code)
      }
      // A guess is irreversible, so on touch it costs a tap to arm first.
      armOnTouch
      onCommit={props.onCommit}
      countryAttributes={(code) => ({ "data-guess-state": stateFor(code) })}
      overlay={(fixed) =>
        hintMarks.map(({ code, coordinates, distanceKm, angle }) => (
          <Marker key={`hint-${code}`} coordinates={coordinates}>
            {/* Fixed on-screen size: a hint that grew with the zoom would
                blanket the countries the player zoomed in to reach. */}
            <g transform={`scale(${fixed})`} pointerEvents="none">
              <path
                data-testid={`map-hint-arrow-${code}`}
                d={ARROW_PATH}
                transform={`rotate(${angle})`}
                fill="#ffffff"
                stroke={MAP_FILLS.border}
                strokeWidth={0.75}
              />
              <text
                y={HINT_LABEL_OFFSET}
                textAnchor="middle"
                fontSize={HINT_LABEL_SIZE}
                fill="#ffffff"
                stroke={MAP_FILLS.border}
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                {`${distanceKm.toFixed()} km`}
              </text>
            </g>
          </Marker>
        ))
      }
    />
  );
};

export default WorldMap;
