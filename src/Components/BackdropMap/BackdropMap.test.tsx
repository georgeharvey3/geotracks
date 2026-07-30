import { vi } from "vitest";

import { fireEvent, render, screen } from "../../test-utils";
import BackdropMap from "./BackdropMap";
import { MAP_FILLS } from "../../map/fills";
import { stragglerMarkers } from "../../map/geography";

// d3-zoom cannot run in jsdom; the rest of the map is the real library.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("../../test/zoomableGroupFake")).default,
}));

describe("BackdropMap", () => {
  it("draws the world at rest", async () => {
    render(<BackdropMap />);

    const france = await screen.findByLabelText("France");
    expect(france).toHaveAttribute("fill", MAP_FILLS.land);
  });

  it("draws no straggler dots — nothing here is a target", async () => {
    render(<BackdropMap />);
    await screen.findByLabelText("France");

    const straggler = stragglerMarkers[0]!;
    expect(screen.queryByLabelText(straggler.name)).not.toBeInTheDocument();
  });

  it("veils the map in black", async () => {
    render(<BackdropMap />);
    await screen.findByLabelText("France");

    expect(screen.getByTestId("page-backdrop-veil")).toBeInTheDocument();
  });

  it("is decoration: click-through, and out of the accessibility tree", async () => {
    render(<BackdropMap />);
    await screen.findByLabelText("France");

    const backdrop = screen.getByTestId("page-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveStyle({ pointerEvents: "none" });
  });

  // The test environment reports a portrait viewport, where an app surface
  // would fit the whole world in below the chrome. The ground under a page has
  // neither to make room for, so it covers.
  it("covers its box rather than fitting the world into a band", async () => {
    const { container } = render(<BackdropMap />);
    await screen.findByLabelText("France");

    expect(container.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid slice",
    );
  });

  it("names no country on hover — nothing here is a target", async () => {
    render(<BackdropMap />);
    const france = await screen.findByLabelText("France");

    // Hover as the map's own tests do: `userEvent.hover`'s act does not settle
    // a low-priority hover update before the assertion.
    fireEvent.mouseEnter(france);

    expect(screen.queryByText("France")).not.toBeInTheDocument();
    expect(france).toHaveAttribute("fill", MAP_FILLS.land);
  });
});
