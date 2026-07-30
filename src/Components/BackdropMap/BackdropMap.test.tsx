import { vi } from "vitest";

import { fireEvent, render, screen } from "../../test-utils";
import BackdropMap from "./BackdropMap";
import { MAP_FILLS } from "../../map/fills";
import { stragglerMarkers } from "../../map/geography";
import { NIGHT_VEIL_OPACITY } from "../../tokens";

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

  // The veil belongs to the map rather than to this component, because it is
  // also what an app surface lifts on the way in — the two directions have to
  // start and end on the same darkness.
  describe("the veil", () => {
    // Which arrival this is comes from module state — a backdrop mounts on the
    // first page of a session and on the return from a map surface, and nowhere
    // else — so each case needs its own copy of the module.
    const freshBackdrop = async () => {
      vi.resetModules();
      return (await import("./BackdropMap")).default;
    };

    it("stands still on the first page of a session", async () => {
      const Backdrop = await freshBackdrop();
      render(<Backdrop />);
      await screen.findByLabelText("France");

      const veil = screen.getByTestId("map-veil");
      expect(veil).toHaveStyle({ opacity: `${NIGHT_VEIL_OPACITY}` });
      // Nothing to come back from: drawing the night on here would mean showing
      // the player a lit world and then putting it out.
      expect(veil).not.toHaveClass("veil-settle");
      expect(veil).not.toHaveClass("veil-lift");
    });

    it("draws the night on when the player comes back from a map surface", async () => {
      const Backdrop = await freshBackdrop();
      const firstPage = render(<Backdrop />);
      await screen.findByLabelText("France");
      // The backdrop leaves for exactly as long as a map surface is showing.
      firstPage.unmount();

      render(<Backdrop />);
      await screen.findByLabelText("France");

      const veil = screen.getByTestId("map-veil");
      expect(veil).toHaveClass("veil-settle");
      // And comes to rest at the darkness a map surface lifts from.
      expect(veil).toHaveStyle({ opacity: `${NIGHT_VEIL_OPACITY}` });
    });
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
