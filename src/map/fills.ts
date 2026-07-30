import { COLORS, MAP_COLORS } from "../tokens";
import { TurnOutcome } from "../types";

// The map's palette, shared by every surface that draws on it.
//
// Land sits well above the sea in lightness so the coastline reads at a glance,
// and the hover highlight goes near-white — a colour nothing else on the map
// uses — so the country under the pointer is unmistakable against its
// neighbours. `inertLand` is what a shape gets when it can't be chosen at all:
// a disputed territory in the game, a country with no music in Explore; it is
// neutral *and* a step darker, because hue alone never separated it from land.
//
// The values live in `src/tokens.ts`; this is the map's naming of them.
export const MAP_FILLS = MAP_COLORS;

// The Run summary's marking, one fill per Turn outcome. A mint-pear-coral run,
// so ten countries read as a shape of the Run at a glance; mint matches the
// guessing map's correct-guess fill, since it means the same thing there.
export const OUTCOME_FILLS: Record<TurnOutcome, string> = {
  "named-first": COLORS.mintDeep,
  "named-later": COLORS.accent,
  missed: COLORS.accent3Deep,
};
