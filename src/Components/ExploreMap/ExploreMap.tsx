import { useMemo } from "react";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS } from "../../map/fills";
import { countryCodeByName, countryNameByCode } from "../../map/geography";

// The country now playing takes the palette's green — the one colour on this
// map that means "this is the one". Everything else is the shared land/inert
// pair: music here, or none.
const NOW_PLAYING_FILL = "#4caf50";

interface ExploreMapProps {
  /** The countries the app holds music for, by name. */
  playableCountries: string[];
  /** The country being listened to, or null before the first choice. */
  selectedCountry: string | null;
  onSelect: (countryName: string) => void;
}

/**
 * The map as Explore's whole interface: Playable countries are live and
 * selectable, the rest are drawn and named but inert. Everything about how a
 * country is picked comes from <BaseMap>; this supplies only what a pick means
 * here (ADR-0003).
 */
const ExploreMap = (props: ExploreMapProps) => {
  const playableCodes = useMemo(() => {
    const codes = props.playableCountries.flatMap((name) => {
      const code = countryCodeByName(name);
      return code ? [code] : [];
    });
    return new Set(codes);
  }, [props.playableCountries]);

  const selectedCode =
    props.selectedCountry === null
      ? undefined
      : countryCodeByName(props.selectedCountry);

  const fillFor = (code: string | undefined, previewed: boolean): string => {
    // An absence of music looks the same as an absence of a country: both are
    // shapes the player can see and name but not choose.
    if (code === undefined || !playableCodes.has(code)) {
      return MAP_FILLS.inertLand;
    }
    if (code === selectedCode) return NOW_PLAYING_FILL;
    if (previewed) return MAP_FILLS.highlight;
    return MAP_FILLS.land;
  };

  return (
    <BaseMap
      fillFor={fillFor}
      selectable={(code) => playableCodes.has(code)}
      // Silent countries still answer to hover: an absence of music is not an
      // absence of geography.
      labelFor={(code) => countryNameByCode(code)}
      // Nothing here is irreversible, so a single tap is enough on touch too.
      armOnTouch={false}
      onCommit={props.onSelect}
      countryAttributes={(code) => ({
        "data-explore-state":
          code === selectedCode
            ? "playing"
            : playableCodes.has(code)
              ? "playable"
              : "silent",
      })}
    />
  );
};

export default ExploreMap;
