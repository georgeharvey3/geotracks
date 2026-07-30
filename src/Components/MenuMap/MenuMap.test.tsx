import { vi } from "vitest";

import { fireEvent, render, screen } from "../../test-utils";
import MenuMap from "./MenuMap";
import { MAP_FILLS } from "../../map/fills";

// d3-zoom cannot run in jsdom; the rest of the map is the real library.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("../../test/zoomableGroupFake")).default,
}));

describe("MenuMap", () => {
  it("draws the world at rest", async () => {
    render(<MenuMap />);

    const france = await screen.findByLabelText("France");
    expect(france).toHaveAttribute("fill", MAP_FILLS.land);
  });

  it("is decoration: click-through, and out of the accessibility tree", async () => {
    render(<MenuMap />);
    await screen.findByLabelText("France");

    const backdrop = screen.getByTestId("menu-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveStyle({ pointerEvents: "none" });
  });

  // The test environment reports a portrait viewport, where an app surface
  // would fit the whole world in below the chrome. The ground under a page has
  // neither to make room for, so it covers.
  it("covers its box rather than fitting the world into a band", async () => {
    const { container } = render(<MenuMap />);
    await screen.findByLabelText("France");

    expect(container.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid slice",
    );
  });

  it("names no country on hover — nothing here is a target", async () => {
    render(<MenuMap />);
    const france = await screen.findByLabelText("France");

    // Hover as the map's own tests do: `userEvent.hover`'s act does not settle
    // a low-priority hover update before the assertion.
    fireEvent.mouseEnter(france);

    expect(screen.queryByText("France")).not.toBeInTheDocument();
    expect(france).toHaveAttribute("fill", MAP_FILLS.land);
  });
});
