import { describe, it, expect } from "vitest";
import getProximityColor, { FAR_DISTANCE_KM } from "./getProximityColor";
import { HEAT } from "../tokens";

const parse = (color: string) => {
  const [h, s, l] = color
    .match(/hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/)!
    .slice(1)
    .map(Number);
  return { h: h!, s: s!, l: l! };
};

// The far hue is stored signed so the scale interpolates down through orange
// rather than round through green; on the way out it is normalised into [0,360).
const FAR_HUE = ((HEAT.far.h % 360) + 360) % 360;

describe("getProximityColor", () => {
  it("is amber for a guess on top of the answer", () => {
    expect(parse(getProximityColor(0)).h).toBe(HEAT.near.h);
  });

  it("is coral once the guess is FAR_DISTANCE_KM away", () => {
    expect(parse(getProximityColor(FAR_DISTANCE_KM)).h).toBeCloseTo(FAR_HUE, 1);
  });

  it("stays coral beyond FAR_DISTANCE_KM rather than wrapping", () => {
    expect(getProximityColor(FAR_DISTANCE_KM * 3)).toBe(
      getProximityColor(FAR_DISTANCE_KM),
    );
  });

  // Hue alone can't carry the ordering — it wraps past 360 at the coral end, and
  // a player who can't separate red from amber never sees it. Lightness is what
  // makes the scale readable as a scale, so that is what is asserted.
  it("darkens monotonically as the guess gets further away", () => {
    const lightness = [0, 1000, 3000, 6000, 9000].map(
      (km) => parse(getProximityColor(km)).l,
    );
    expect(lightness).toEqual([...lightness].sort((a, b) => b - a));
    expect(new Set(lightness).size).toBe(lightness.length);
  });

  it("never lightens above the near end or below the far end", () => {
    const sampled = [0, 2500, 5000, 7500, 10000].map(
      (km) => parse(getProximityColor(km)).l,
    );
    expect(Math.max(...sampled)).toBeLessThanOrEqual(HEAT.near.l);
    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(HEAT.far.l);
  });

  it("treats a negative distance as zero", () => {
    expect(getProximityColor(-100)).toBe(getProximityColor(0));
  });
});
