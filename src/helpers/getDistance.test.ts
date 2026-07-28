import getDistance from "./getDistance";

describe("getDistance", () => {
  it("returns 0 for the same coordinates", () => {
    expect(getDistance(51.5, -0.12, 51.5, -0.12)).toBe(0);
  });

  it("calculates distance between London and Paris (~343 km)", () => {
    const distance = getDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(360);
  });

  it("calculates distance between New York and Los Angeles (~3940 km)", () => {
    const distance = getDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4000);
  });

  it("calculates distance between poles (~20000 km)", () => {
    const distance = getDistance(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(19900);
    expect(distance).toBeLessThan(20100);
  });

  it("handles crossing the antimeridian", () => {
    const distance = getDistance(0, 179, 0, -179);
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(250);
  });
});
