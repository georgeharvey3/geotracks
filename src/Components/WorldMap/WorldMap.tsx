import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, useMediaQuery } from "@mui/material";
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
import { CHROME_CLEARANCE, LANDSCAPE_QUERY } from "../../layout";
import { Guess } from "../../types";

// Land sits well above the sea in lightness so the coastline reads at a glance,
// and the hover highlight goes near-white — a colour nothing else on the map
// uses — so the country under the pointer is unmistakable against its
// neighbours. `wrong` is the hints-off marking: a flat desaturated red, well
// clear of the saturated proximity-heat scale, carrying no distance at all.
const FILLS = {
  sea: "#0b1a30",
  land: "#7d9cbb",
  inertLand: "#4c5f75",
  highlight: "#eaf4ff",
  wrong: "#8b4a4a",
  correct: "#4caf50",
  answer: "#ffa726",
  border: "#0b1a30",
} as const;

// How far in the player may zoom. Generous, because the furniture is
// counter-scaled: zooming is how you separate a crowded archipelago and reach
// the country under a pile of hints.
const MAX_ZOOM = 24;

// The SVG viewBox, which the projection is sized to fill (`geoEqualEarth` at
// scale 145 spans almost exactly this box).
const MAP_WIDTH = 800;
const MAP_HEIGHT = 400;

// Panning is bounded to the world itself: d3-zoom measures its extent from the
// viewBox, so clamping the translation to the same box means the viewport can
// never leave the map. At zoom 1 that pins it outright; zoomed in, the player
// can reach any edge but not drag the world off into empty sea and lose it.
const WORLD_EXTENT: [[number, number], [number, number]] = [
  [0, 0],
  [MAP_WIDTH, MAP_HEIGHT],
];

// How far above the pointer the hover tooltip floats, in px.
const TOOLTIP_LIFT = 12;

// Sizes of the map's furniture — country outlines, straggler dots, hint arrows
// and labels — in screen units at zoom 1. Everything inside the zoomable group
// is counter-scaled by 1/zoom so these stay put as the player zooms: otherwise
// hints swell to cover whole regions and neighbouring straggler dots merge.
const BORDER_WIDTH = 0.3;
const STRAGGLER_RADIUS = 3.5;
const STRAGGLER_STROKE = 0.75;
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
  const isLandscape = useMediaQuery(LANDSCAPE_QUERY);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [armedCode, setArmedCode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  // Panning reports every tick too, so only a real zoom change re-renders. The
  // callback is stable because react-simple-maps re-attaches d3-zoom whenever
  // it changes identity.
  const handleMove = useCallback(({ zoom: next }: { zoom: number }) => {
    setZoom((current) => (current === next ? current : next));
  }, []);

  // Counter-scale for anything that should keep its size on screen.
  const fixed = 1 / zoom;

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
        // With hints off every wrong guess gets the same flat red, however near
        // or far it was: the map says "wrong", but may never convey proximity
        // the player opted out of.
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

  // The tooltip is moved by writing to its DOM node rather than through state.
  // The pointer moves more often than anything else on this screen — up to a
  // few hundred times a second — and re-rendering for each one would rebuild
  // every country path on the map, hundreds of them, just to shift one label.
  const placeTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    const bounds = containerRef.current?.getBoundingClientRect();
    const at = pointerRef.current;
    if (!tooltip || !bounds || !at) return;
    tooltip.style.left = `${at.x - bounds.left}px`;
    tooltip.style.top = `${at.y - bounds.top - TOOLTIP_LIFT}px`;
  }, []);

  // Coalesced to one write per frame: pointer events outrun paint.
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      placeTooltip();
    });
  };

  // Place it the moment it appears, before paint — otherwise a tooltip shown on
  // mouseenter sits at the map's origin until the next mousemove.
  useLayoutEffect(placeTooltip, [placeTooltip, hoveredCode]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const previewedCode = hoveredCode ?? armedCode;
  const previewedName = previewedCode
    ? countryNameByCode(previewedCode)
    : undefined;

  // The hovered name follows the cursor (positioned by `placeTooltip`); an armed
  // (tapped) name sits at the top of the map, clear of the finger and of the
  // layout's overlay chrome.
  const followsPointer = hoveredCode !== null;
  const labelPosition = followsPointer
    ? { transform: "translate(-50%, -100%)" }
    : {
        left: "50%",
        top: CHROME_CLEARANCE + 8,
        transform: "translateX(-50%)",
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

  const cursor = props.finished ? "default" : "pointer";
  const interactionStyle = {
    default: { outline: "none", cursor },
    hover: { outline: "none", cursor },
    pressed: { outline: "none", cursor },
  };

  return (
    <Box
      ref={containerRef}
      onMouseMove={hasHover ? handleMouseMove : undefined}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        bgcolor: FILLS.sea,
        touchAction: "none",
      }}
    >
      {/* The inset lives on an inner box rather than as padding on the
          container, so the container's box stays the frame the pointer
          coordinates and the tooltip are both measured against. */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          top: isLandscape ? 0 : `${CHROME_CLEARANCE}px`,
        }}
      >
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 145 }}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          // Landscape covers the viewport, cropping the empty polar bands;
          // portrait fits the world into the band the layout reserves for it.
          preserveAspectRatio={isLandscape ? "xMidYMid slice" : "xMidYMid meet"}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <ZoomableGroup
            minZoom={1}
            maxZoom={MAX_ZOOM}
            translateExtent={WORLD_EXTENT}
            onMove={handleMove}
          >
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
                      strokeWidth={BORDER_WIDTH * fixed}
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
                {/* Fixed on-screen size: zooming in separates crowded island
                    dots instead of inflating them into each other. */}
                <g transform={`scale(${fixed})`}>
                  <circle
                    r={STRAGGLER_RADIUS}
                    tabIndex={-1}
                    fill={fillFor(marker.code, true)}
                    stroke={FILLS.border}
                    strokeWidth={STRAGGLER_STROKE}
                    aria-label={marker.name}
                    data-guess-state={stateFor(marker.code)}
                    onClick={() => armOrCommit(marker.code)}
                    onMouseEnter={() => handleMouseEnter(marker.code)}
                    onMouseLeave={handleMouseLeave}
                    style={{ cursor }}
                  />
                </g>
              </Marker>
            ))}

            {hintMarks.map(({ code, coordinates, distanceKm, angle }) => (
              <Marker key={`hint-${code}`} coordinates={coordinates}>
                {/* Likewise fixed: a hint that grew with the zoom would blanket
                    the countries the player zoomed in to reach. */}
                <g transform={`scale(${fixed})`} pointerEvents="none">
                  <path
                    data-testid={`map-hint-arrow-${code}`}
                    d={ARROW_PATH}
                    transform={`rotate(${angle})`}
                    fill="#ffffff"
                    stroke={FILLS.border}
                    strokeWidth={0.75}
                  />
                  <text
                    y={HINT_LABEL_OFFSET}
                    textAnchor="middle"
                    fontSize={HINT_LABEL_SIZE}
                    fill="#ffffff"
                    stroke={FILLS.border}
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    {`${distanceKm.toFixed()} km`}
                  </text>
                </g>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </Box>

      {previewedName && (
        <Box
          // Remounted when the tooltip changes mode, so the coordinates written
          // straight onto the node can't outlive the pointer-following one.
          key={followsPointer ? "pointer" : "armed"}
          ref={followsPointer ? tooltipRef : null}
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
