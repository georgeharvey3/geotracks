import { describe, it, expect } from "vitest";
import getProximityColor, { FAR_DISTANCE_KM } from "./getProximityColor";

const hue = (color: string) => Number(color.match(/hsl\((\d+(?:\.\d+)?)/)![1]);

describe("getProximityColor", () => {
  it("is yellow for a guess on top of the answer", () => {
    expect(hue(getProximityColor(0))).toBe(52);
  });

  it("is red once the guess is FAR_DISTANCE_KM away", () => {
    expect(hue(getProximityColor(FAR_DISTANCE_KM))).toBe(0);
  });

  it("stays red beyond FAR_DISTANCE_KM rather than wrapping", () => {
    expect(hue(getProximityColor(FAR_DISTANCE_KM * 3))).toBe(0);
  });

  it("deepens monotonically as the guess gets further away", () => {
    const hues = [0, 1000, 3000, 6000, 9000].map((km) =>
      hue(getProximityColor(km)),
    );
    const sorted = [...hues].sort((a, b) => b - a);
    expect(hues).toEqual(sorted);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it("treats a negative distance as zero", () => {
    expect(getProximityColor(-100)).toBe(getProximityColor(0));
  });
});
