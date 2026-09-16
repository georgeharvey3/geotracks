import { describe, it, expect } from "vitest";

import { safeArea } from "./layout";

describe("safeArea", () => {
  it("adds the inset to the spacing the design already wanted", () => {
    expect(safeArea("bottom", 12)).toBe(
      "calc(12px + env(safe-area-inset-bottom, 0px))",
    );
  });

  it("reads each edge separately", () => {
    expect(safeArea("top", 0)).toContain("safe-area-inset-top");
    expect(safeArea("right", 0)).toContain("safe-area-inset-right");
    expect(safeArea("left", 0)).toContain("safe-area-inset-left");
  });

  it("always passes a fallback, so the declaration survives an engine without env()", () => {
    // This is the load-bearing part. A browser that does not know `env()` drops
    // the whole declaration rather than the function, so a bare
    // `env(safe-area-inset-top)` would throw away the 24px the layout wanted —
    // the padding would go to zero everywhere that isn't a recent iPhone.
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      expect(safeArea(edge, 24)).toContain(`env(safe-area-inset-${edge}, 0px)`);
    }
  });
});
