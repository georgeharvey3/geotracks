import { describe, it, expect } from "vitest";
import getProximityColor, { COLD_DISTANCE_KM } from "./getProximityColor";

const hue = (color: string) => Number(color.match(/hsl\((\d+(?:\.\d+)?)/)![1]);

describe("getProximityColor", () => {
  it("is hot (red) for a guess on top of the answer", () => {
    expect(hue(getProximityColor(0))).toBe(0);
  });

  it("is cold (blue) once the guess is COLD_DISTANCE_KM away", () => {
    expect(hue(getProximityColor(COLD_DISTANCE_KM))).toBe(220);
  });

  it("stays cold beyond COLD_DISTANCE_KM rather than wrapping", () => {
    expect(hue(getProximityColor(COLD_DISTANCE_KM * 3))).toBe(220);
  });

  it("cools monotonically as the guess gets further away", () => {
    const hues = [0, 1000, 3000, 6000, 9000].map((km) =>
      hue(getProximityColor(km)),
    );
    const sorted = [...hues].sort((a, b) => a - b);
    expect(hues).toEqual(sorted);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it("treats a negative distance as zero", () => {
    expect(getProximityColor(-100)).toBe(getProximityColor(0));
  });
});
