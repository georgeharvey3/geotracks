// Proximity heat: the colour a wrongly-guessed country is filled with on the
// map when geo-hints are on. The scale runs amber → orange → red: amber means
// the guess was geographically close to the answer, deepening to coral as it
// gets further away. It re-presents the same distance the text geo-hint already
// states — never more — so it is only ever used when geo-hints are enabled.
//
// The scale descends in *lightness* as well as hue. Hue alone would order the
// scale only for players who can separate red from amber, and on cream land a
// pale near-end would barely read at all; the endpoints live in `src/tokens.ts`.

import { HEAT } from "../tokens";

// Distance at which the scale bottoms out at fully coral. Beyond this, guesses
// are all "nowhere near" and don't need to be told apart.
export const FAR_DISTANCE_KM = 10000;

const lerp = (from: number, to: number, t: number) => from + t * (to - from);

function getProximityColor(distanceKm: number): string {
  const farness =
    Math.min(Math.max(distanceKm, 0), FAR_DISTANCE_KM) / FAR_DISTANCE_KM;

  // The far hue is held signed (-12 rather than 348) so interpolating walks
  // down through orange and red rather than the long way round through green.
  const hue = lerp(HEAT.near.h, HEAT.far.h, farness);
  const saturation = lerp(HEAT.near.s, HEAT.far.s, farness);
  const lightness = lerp(HEAT.near.l, HEAT.far.l, farness);

  return `hsl(${((hue % 360) + 360) % 360}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
}

export default getProximityColor;
