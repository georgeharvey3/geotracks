import getBearing from "./getBearing";

describe("getBearing", () => {
  it("returns N when destination is due north", () => {
    expect(getBearing(0, 0, 10, 0)).toBe("N");
  });

  it("returns S when destination is due south", () => {
    expect(getBearing(10, 0, 0, 0)).toBe("S");
  });

  it("returns E when destination is due east", () => {
    expect(getBearing(0, 0, 0, 10)).toBe("E");
  });

  it("returns W when destination is due west", () => {
    expect(getBearing(0, 0, 0, -10)).toBe("W");
  });

  it("returns NE for northeast direction", () => {
    expect(getBearing(0, 0, 5, 5)).toBe("NE");
  });

  it("returns SE for southeast direction", () => {
    expect(getBearing(10, 0, 5, 5)).toBe("SE");
  });

  it("returns SW for southwest direction", () => {
    expect(getBearing(10, 0, 5, -5)).toBe("SW");
  });

  it("returns NW for northwest direction", () => {
    expect(getBearing(0, 0, 5, -5)).toBe("NW");
  });

  it("returns a valid direction type", () => {
    const validDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const result = getBearing(51.5, -0.12, 48.85, 2.35);
    expect(validDirections).toContain(result);
  });
});
