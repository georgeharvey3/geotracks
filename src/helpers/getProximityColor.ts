// Proximity heat: the colour a wrongly-guessed country is filled with on the
// map when geo-hints are on. The scale runs yellow → orange → red: yellow means
// the guess was geographically close to the answer, deepening to red as it gets
// further away. It re-presents the same distance the text geo-hint already
// states — never more — so it is only ever used when geo-hints are enabled.

// Distance at which the scale bottoms out at fully red. Beyond this, guesses
// are all "nowhere near" and don't need to be told apart.
export const FAR_DISTANCE_KM = 10000;

const NEAR_HUE = 52; // yellow
const FAR_HUE = 0; // red

function getProximityColor(distanceKm: number): string {
  const farness =
    Math.min(Math.max(distanceKm, 0), FAR_DISTANCE_KM) / FAR_DISTANCE_KM;
  const hue = NEAR_HUE + farness * (FAR_HUE - NEAR_HUE);
  return `hsl(${hue.toFixed(1)}, 78%, 50%)`;
}

export default getProximityColor;
