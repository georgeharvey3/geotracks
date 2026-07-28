// Proximity heat: the colour a wrongly-guessed country is filled with on the
// map when geo-hints are on. Hot (red) means the guess was geographically close
// to the answer, cold (blue) means far. It re-presents the same distance the
// text geo-hint already states — never more — so it is only ever used when
// geo-hints are enabled.

// Distance at which the scale bottoms out at fully cold. Beyond this, guesses
// are all "nowhere near" and don't need to be told apart.
export const COLD_DISTANCE_KM = 10000;

const HOT_HUE = 0; // red
const COLD_HUE = 220; // blue

function getProximityColor(distanceKm: number): string {
  const coldness =
    Math.min(Math.max(distanceKm, 0), COLD_DISTANCE_KM) / COLD_DISTANCE_KM;
  const hue = HOT_HUE + coldness * (COLD_HUE - HOT_HUE);
  return `hsl(${hue.toFixed(1)}, 70%, 52%)`;
}

export default getProximityColor;
