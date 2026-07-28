import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

import getProximityColor from "../../helpers/getProximityColor";
import useHasHover from "../../hooks/useHasHover";
import {
  Coordinates,
  countryCodeByName,
  countryCoordinates,
  countryNameByCode,
  polygonCodes,
  stragglerMarkers,
  topology,
} from "../../map/geography";
import { Guess } from "../../types";

const FILLS = {
  land: "#2f4257",
  inertLand: "#26323f",
  highlight: "#4a6a8f",
  wrong: "#6b7280",
  correct: "#66bb6a",
  answer: "#ffa726",
  border: "#1a1a2e",
} as const;

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

const stragglerCodes = new Set(stragglerMarkers.map((marker) => marker.code));

type MapGeography = { rsmKey: string; id?: string };

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

const WorldMap = (props: WorldMapProps) => {
  const hasHover = useHasHover();
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [armedCode, setArmedCode] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // The round is over: drop any preview so a country armed in this round can't
  // commit on its first tap in the next one.
  const { finished } = props;
  useEffect(() => {
    if (finished) {
      setArmedCode(null);
      setHoveredCode(null);
    }
  }, [finished]);

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

  const fillFor = (code: string | undefined, guessable: boolean): string => {
    if (code === undefined) return FILLS.inertLand;

    switch (stateFor(code)) {
      case "correct":
        return FILLS.correct;
      case "wrong": {
        // With hints off the fill must stay neutral: the map may never convey
        // proximity the player opted out of.
        const distance = guessByCode.get(code)?.distance;
        return props.showGeoHints && distance !== undefined
          ? getProximityColor(distance)
          : FILLS.wrong;
      }
      case "answer":
        return FILLS.answer;
      default:
        if (!guessable) return FILLS.inertLand;
        if (code === armedCode || code === hoveredCode) return FILLS.highlight;
        return FILLS.land;
    }
  };

  const armOrCommit = (code: string) => {
    if (props.finished) return;

    // Touch: the first tap only previews the country under the finger.
    if (!hasHover && armedCode !== code) {
      setArmedCode(code);
      return;
    }

    setArmedCode(null);
    const name = countryNameByCode(code);
    if (name) props.onCommit(name);
  };

  const handleMouseEnter = (code: string) => {
    if (hasHover && !props.finished) setHoveredCode(code);
  };

  const handleMouseLeave = () => {
    if (hasHover) setHoveredCode(null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPointer({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  const previewedCode = hoveredCode ?? armedCode;
  const previewedName = previewedCode
    ? countryNameByCode(previewedCode)
    : undefined;

  // The hovered name follows the cursor; an armed (tapped) name sits above the
  // map, clear of the finger.
  const labelPosition =
    hoveredCode && pointer
      ? {
          left: pointer.x,
          top: pointer.y - 12,
          transform: "translate(-50%, -100%)",
        }
      : { left: "50%", top: 8, transform: "translateX(-50%)" };

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

  const cursor = props.finished ? "default" : "pointer";
  const interactionStyle = {
    default: { outline: "none", cursor },
    hover: { outline: "none", cursor },
    pressed: { outline: "none", cursor },
  };

  return (
    <Box
      ref={containerRef}
      onMouseMove={handleMouseMove}
      sx={{
        position: "relative",
        width: "100%",
        mx: "auto",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        touchAction: "none",
      }}
    >
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 145 }}
        width={800}
        height={400}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <ZoomableGroup minZoom={1} maxZoom={8}>
          <Geographies geography={topology}>
            {({ geographies }: { geographies: MapGeography[] }) =>
              geographies.map((geo) => {
                // Undefined for shapes the app has no country for (disputed
                // territories, and countries missing from countries.json): they
                // are drawn as background land, but can't be committed.
                const code =
                  geo.id !== undefined && polygonCodes.has(geo.id)
                    ? geo.id
                    : undefined;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    tabIndex={-1}
                    fill={fillFor(code, code !== undefined)}
                    stroke={FILLS.border}
                    strokeWidth={0.3}
                    // A straggler's point-marker is its labelled target; the
                    // polygon underneath stays clickable for players who zoom in.
                    aria-label={
                      code !== undefined && !stragglerCodes.has(code)
                        ? countryNameByCode(code)
                        : undefined
                    }
                    data-guess-state={
                      code !== undefined ? stateFor(code) : undefined
                    }
                    onClick={
                      code !== undefined ? () => armOrCommit(code) : undefined
                    }
                    onMouseEnter={
                      code !== undefined
                        ? () => handleMouseEnter(code)
                        : undefined
                    }
                    onMouseLeave={
                      code !== undefined ? handleMouseLeave : undefined
                    }
                    style={code !== undefined ? interactionStyle : undefined}
                  />
                );
              })
            }
          </Geographies>

          {stragglerMarkers.map((marker) => (
            <Marker key={marker.code} coordinates={marker.coordinates}>
              <circle
                r={3.5}
                tabIndex={-1}
                fill={fillFor(marker.code, true)}
                stroke={FILLS.border}
                strokeWidth={0.75}
                aria-label={marker.name}
                data-guess-state={stateFor(marker.code)}
                onClick={() => armOrCommit(marker.code)}
                onMouseEnter={() => handleMouseEnter(marker.code)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor }}
              />
            </Marker>
          ))}

          {hintMarks.map(({ code, coordinates, distanceKm, angle }) => (
            <Marker key={`hint-${code}`} coordinates={coordinates}>
              <path
                data-testid={`map-hint-arrow-${code}`}
                d={ARROW_PATH}
                transform={`rotate(${angle})`}
                fill="#ffffff"
                stroke={FILLS.border}
                strokeWidth={0.75}
                pointerEvents="none"
              />
              <text
                y={22}
                textAnchor="middle"
                fontSize={11}
                fill="#ffffff"
                stroke={FILLS.border}
                strokeWidth={3}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {`${distanceKm.toFixed()} km`}
              </text>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {previewedName && (
        <Box
          sx={{
            position: "absolute",
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: "rgba(26, 26, 46, 0.9)",
            border: "1px solid",
            borderColor: "divider",
            fontSize: "0.8rem",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            ...labelPosition,
          }}
        >
          {previewedName}
        </Box>
      )}
    </Box>
  );
};

export default WorldMap;
