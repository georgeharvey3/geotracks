import { useMemo } from "react";

import BaseMap from "../WorldMap/BaseMap";
import { MAP_FILLS } from "../../map/fills";
import { countryCodeByName, countryNameByCode } from "../../map/geography";
import { COLORS } from "../../tokens";

// The country now playing takes the palette's mint — the one colour on this
// map that means "this is the one". Everything else is the shared land/inert
// pair: music here, or none.
const NOW_PLAYING_FILL = COLORS.mintDeep;

interface ExploreMapProps {
  /** The countries the app holds music for, by name. */
  playableCountries: string[];
  /** The country being listened to, or null before the first choice. */
  selectedCountry: string | null;
  /** The silent country the player has picked in order to ask about it. */
  askedAboutCountry: string | null;
  onSelect: (countryName: string) => void;
  onAskAbout: (countryName: string) => void;
}

/**
 * The map as Explore's whole interface: Playable countries are live and
 * selectable, and the silent ones are selectable too — not to listen to, but to
 * ask about. Everything about how a country is picked comes from <BaseMap>;
 * this supplies only what a pick means here (ADR-0003).
 */
const ExploreMap = (props: ExploreMapProps) => {
  const { playableCountries } = props;
  const playableCodes = useMemo(() => {
    const codes = playableCountries.flatMap((name) => {
      const code = countryCodeByName(name);
      return code ? [code] : [];
    });
    return new Set(codes);
  }, [playableCountries]);

  // The same set by name, because a commit arrives as a name: the alternative
  // is converting it back to a code the base map already had, and inventing a
  // sentinel for the conversion that fails.
  const playableNames = useMemo(
    () => new Set(playableCountries),
    [playableCountries],
  );

  const selectedCode =
    props.selectedCountry === null
      ? undefined
      : countryCodeByName(props.selectedCountry);

  const askedAboutCode =
    props.askedAboutCountry === null
      ? undefined
      : countryCodeByName(props.askedAboutCountry);

  const fillFor = (code: string | undefined, previewed: boolean): string => {
    // A shape the app has no country for at all: nothing to play and nothing to
    // ask about either, so it stays inert.
    if (code === undefined) return MAP_FILLS.inertLand;
    if (code === selectedCode) return NOW_PLAYING_FILL;
    // The country being asked about keeps the preview fill after the pointer
    // has gone: it is picked, and the panel is now talking about it.
    if (previewed || code === askedAboutCode) return MAP_FILLS.highlight;
    return playableCodes.has(code) ? MAP_FILLS.land : MAP_FILLS.inertLand;
  };

  return (
    <BaseMap
      fillFor={fillFor}
      // Every country the app knows can be picked. An absence of music was an
      // absence of nothing but music; now it is an invitation.
      selectable={() => true}
      labelFor={(code) => countryNameByCode(code)}
      // Reached from the menu, which stands on this map in the dark.
      veil="lift"
      // Nothing here is irreversible, so a single tap is enough on touch too —
      // which is exactly why a silent country only tells the panel below rather
      // than navigating anywhere.
      armOnTouch={false}
      onCommit={(name) =>
        playableNames.has(name) ? props.onSelect(name) : props.onAskAbout(name)
      }
      // The two picks are the two marks: mint alone is 2.0:1 against land, and
      // the preview fill is lighter still.
      marked={(code) => code === selectedCode || code === askedAboutCode}
      countryAttributes={(code) => ({
        "data-explore-state":
          code === selectedCode
            ? "playing"
            : code === askedAboutCode
              ? "asked"
              : playableCodes.has(code)
                ? "playable"
                : "silent",
      })}
    />
  );
};

export default ExploreMap;
