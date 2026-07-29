import React, {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
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

import useHasHover from "../../hooks/useHasHover";
import { MAP_FILLS } from "../../map/fills";
import {
  countryNameByCode,
  polygonCodes,
  stragglerMarkers,
  topology,
} from "../../map/geography";
import { CHROME_CLEARANCE, LANDSCAPE_QUERY } from "../../layout";

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

// Sizes of the map's furniture — country outlines and straggler dots — in
// screen units at zoom 1. Everything inside the zoomable group is
// counter-scaled by 1/zoom so these stay put as the player zooms: otherwise
// neighbouring straggler dots merge and any overlay swells to cover whole
// regions.
const BORDER_WIDTH = 0.3;
const STRAGGLER_RADIUS = 3.5;
const STRAGGLER_STROKE = 0.75;

const stragglerCodes = new Set(stragglerMarkers.map((marker) => marker.code));

type MapGeography = { rsmKey: string; id?: string };

interface BaseMapProps {
  /**
   * Fill for one country's shape. `code` is undefined for shapes the app has no
   * country for at all; `previewed` is true while the pointer is over it, or
   * while it is the armed target of a tap.
   */
  fillFor: (code: string | undefined, previewed: boolean) => string;
  /** Whether this country may be chosen right now. */
  selectable: (code: string) => boolean;
  /**
   * What the hover tooltip says for a country, or undefined to show none. The
   * country's accessible name is unaffected — that is geography, not preview.
   */
  labelFor: (code: string) => string | undefined;
  /**
   * Touch rule. With `true`, the first tap only arms a country and a second tap
   * on it commits — the guard an irreversible choice deserves. Surfaces with
   * nothing irreversible to protect pass `false` and commit on one tap.
   */
  armOnTouch: boolean;
  onCommit: (countryName: string) => void;
  /**
   * Extra attributes for one country's shape — the handle a surface marks its
   * own state through.
   */
  countryAttributes?: (code: string) => Record<string, string | undefined>;
  /**
   * Drawn inside the zoomable group, on top of the countries. `fixed` is the
   * 1/zoom counter-scale to apply to anything that should keep its on-screen
   * size.
   */
  overlay?: (fixed: number) => ReactNode;
}

/**
 * The world map, surface-neutral: it owns how a country is picked and nothing
 * about what picking one means.
 *
 * Everything device-facing lives here — the Equal Earth projection, panning
 * bounded to the world, the 1/zoom counter-scale that holds furniture at a
 * constant on-screen size, straggler point-markers, the hover tooltip, and
 * commit-on-click. What a country looks like, whether it may be chosen, what
 * the tooltip says and anything drawn over the top come from the caller, so
 * this component never has to know which surface is using it (ADR-0003).
 */
const BaseMap = (props: BaseMapProps) => {
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

  // An armed country that stops being selectable — the round ended under it —
  // is forgotten, so it can't commit on its first tap once it comes back.
  const { selectable } = props;
  const armedSelectable = armedCode !== null && selectable(armedCode);
  useEffect(() => {
    if (!armedSelectable) setArmedCode(null);
  }, [armedSelectable]);

  const armOrCommit = (code: string) => {
    if (!props.selectable(code)) return;

    // Touch, where the choice is worth guarding: the first tap only previews
    // the country under the finger.
    if (props.armOnTouch && !hasHover && armedCode !== code) {
      setArmedCode(code);
      return;
    }

    setArmedCode(null);
    const name = countryNameByCode(code);
    if (name) props.onCommit(name);
  };

  const handleMouseEnter = (code: string) => {
    if (hasHover) setHoveredCode(code);
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

  const previewedCode = hoveredCode ?? (armedSelectable ? armedCode : null);
  const previewedLabel = previewedCode
    ? props.labelFor(previewedCode)
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

  const isPreviewed = (code: string) => code === previewedCode;

  const interactionStyle = (code: string) => {
    const cursor = props.selectable(code) ? "pointer" : "default";
    return {
      default: { outline: "none", cursor },
      hover: { outline: "none", cursor },
      pressed: { outline: "none", cursor },
    };
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
        bgcolor: MAP_FILLS.sea,
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
                  // territories, and countries missing from countries.json):
                  // they are drawn as background land, but can't be chosen.
                  const code =
                    geo.id !== undefined && polygonCodes.has(geo.id)
                      ? geo.id
                      : undefined;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      tabIndex={-1}
                      fill={props.fillFor(
                        code,
                        code !== undefined && isPreviewed(code),
                      )}
                      stroke={MAP_FILLS.border}
                      strokeWidth={BORDER_WIDTH * fixed}
                      // A straggler's point-marker is its labelled target; the
                      // polygon underneath stays clickable for players who zoom in.
                      aria-label={
                        code !== undefined && !stragglerCodes.has(code)
                          ? countryNameByCode(code)
                          : undefined
                      }
                      {...(code !== undefined
                        ? props.countryAttributes?.(code)
                        : undefined)}
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
                      style={
                        code !== undefined ? interactionStyle(code) : undefined
                      }
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
                    fill={props.fillFor(marker.code, isPreviewed(marker.code))}
                    stroke={MAP_FILLS.border}
                    strokeWidth={STRAGGLER_STROKE}
                    aria-label={marker.name}
                    {...props.countryAttributes?.(marker.code)}
                    onClick={() => armOrCommit(marker.code)}
                    onMouseEnter={() => handleMouseEnter(marker.code)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      cursor: props.selectable(marker.code)
                        ? "pointer"
                        : "default",
                    }}
                  />
                </g>
              </Marker>
            ))}

            {props.overlay?.(fixed)}
          </ZoomableGroup>
        </ComposableMap>
      </Box>

      {previewedLabel && (
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
          {previewedLabel}
        </Box>
      )}
    </Box>
  );
};

export default BaseMap;
