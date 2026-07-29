import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../../test-utils";
import userEvent from "@testing-library/user-event";

import WorldMap from "./WorldMap";
import getProximityColor from "../../helpers/getProximityColor";
import { setHoverCapability } from "../../test/hoverCapability";
import { zoomTo } from "../../test/zoomableGroupFake";
import { Guess } from "../../types";

vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("../../test/zoomableGroupFake")).default,
}));

// The map's clickable target for a country: its polygon, or — for a straggler
// like Monaco — its point-marker.
const target = (name: string) => screen.getByLabelText(name);
const stateOf = (name: string) => target(name).getAttribute("data-guess-state");
const fillOf = (name: string) => target(name).getAttribute("fill");

const wrong = (
  country: string,
  distance: number,
  direction: string,
): Guess => ({
  country,
  correct: false,
  distance,
  direction,
});

let onCommit: ReturnType<typeof vi.fn>;

function renderMap(props: Partial<React.ComponentProps<typeof WorldMap>> = {}) {
  return render(
    <WorldMap
      guesses={[]}
      showGeoHints={false}
      answer="Brazil"
      finished={false}
      onCommit={onCommit}
      {...props}
    />,
  );
}

beforeEach(() => {
  onCommit = vi.fn();
});

describe("WorldMap", () => {
  describe("targets", () => {
    it("draws a polygon for a mapped country and a point-marker for a straggler", () => {
      renderMap();

      expect(target("France").tagName).toBe("path");
      expect(target("France")).toHaveAttribute("d");
      expect(target("Monaco").tagName).toBe("circle");
    });
  });

  describe("commit-on-click with a hovering pointer", () => {
    it("commits a country on a single click", async () => {
      renderMap();

      await userEvent.click(target("France"));

      expect(onCommit).toHaveBeenCalledWith("France");
    });

    it("commits a straggler from its point-marker", async () => {
      renderMap();

      await userEvent.click(target("Monaco"));

      expect(onCommit).toHaveBeenCalledWith("Monaco");
    });

    it("shows the country name on hover and hides it again", () => {
      renderMap();

      fireEvent.mouseEnter(target("France"));
      expect(screen.getByText("France")).toBeInTheDocument();

      fireEvent.mouseLeave(target("France"));
      expect(screen.queryByText("France")).not.toBeInTheDocument();
    });
  });

  describe("commit-on-click on touch", () => {
    beforeEach(() => setHoverCapability(false));

    it("arms a country on the first tap and commits on the second", async () => {
      renderMap();

      await userEvent.click(target("France"));
      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("France")).toBeInTheDocument();

      await userEvent.click(target("France"));
      expect(onCommit).toHaveBeenCalledWith("France");
    });

    it("moves the preview when a different country is tapped", async () => {
      renderMap();

      await userEvent.click(target("France"));
      await userEvent.click(target("Brazil"));

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("Brazil")).toBeInTheDocument();
      expect(screen.queryByText("France")).not.toBeInTheDocument();

      await userEvent.click(target("Brazil"));
      expect(onCommit).toHaveBeenCalledWith("Brazil");
    });

    it("forgets an armed country when the round ends", async () => {
      const { rerender } = renderMap();

      await userEvent.click(target("France"));
      rerender(
        <WorldMap
          guesses={[wrong("France", 8000, "SW")]}
          showGeoHints={false}
          answer="Brazil"
          finished={true}
          onCommit={onCommit}
        />,
      );
      rerender(
        <WorldMap
          guesses={[]}
          showGeoHints={false}
          answer="Peru"
          finished={false}
          onCommit={onCommit}
        />,
      );

      // Next round: the first tap must arm again, not commit.
      await userEvent.click(target("France"));
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("arms a straggler's point-marker the same way", async () => {
      renderMap();

      await userEvent.click(target("Monaco"));
      expect(onCommit).not.toHaveBeenCalled();

      await userEvent.click(target("Monaco"));
      expect(onCommit).toHaveBeenCalledWith("Monaco");
    });
  });

  describe("marking guesses with geo-hints on", () => {
    const guesses = [wrong("France", 8000, "SW"), wrong("Peru", 2000, "E")];

    it("fills each wrong guess with proximity heat and labels the distance", () => {
      renderMap({ guesses, showGeoHints: true });

      expect(fillOf("France")).toBe(getProximityColor(8000));
      expect(fillOf("Peru")).toBe(getProximityColor(2000));
      expect(screen.getByText("8000 km")).toBeInTheDocument();
      expect(screen.getByText("2000 km")).toBeInTheDocument();
    });

    it("points an arrow along the direction to the answer", () => {
      renderMap({ guesses, showGeoHints: true });

      expect(screen.getByTestId("map-hint-arrow-FR")).toHaveAttribute(
        "transform",
        expect.stringContaining("rotate(225)"),
      );
      expect(screen.getByTestId("map-hint-arrow-PE")).toHaveAttribute(
        "transform",
        expect.stringContaining("rotate(90)"),
      );
    });

    it("keeps every guess of the round marked", () => {
      renderMap({ guesses, showGeoHints: true });

      expect(stateOf("France")).toBe("wrong");
      expect(stateOf("Peru")).toBe("wrong");
    });
  });

  describe("marking guesses with geo-hints off", () => {
    const guesses = [wrong("France", 8000, "SW"), wrong("Peru", 2000, "E")];

    it("marks wrong guesses without leaking how close they were", () => {
      renderMap({ guesses, showGeoHints: false });

      expect(stateOf("France")).toBe("wrong");
      expect(stateOf("Peru")).toBe("wrong");
      // The same flat fill however far apart the two guesses were.
      expect(fillOf("France")).toBe(fillOf("Peru"));
    });

    it("shows no distance label and no direction arrow", () => {
      renderMap({ guesses, showGeoHints: false });

      expect(screen.queryByText(/km/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("map-hint-arrow-FR")).not.toBeInTheDocument();
    });
  });

  describe("zooming", () => {
    // The scale wrapper each marker sits in: the map cancels the zoom out of it
    // so the furniture keeps its on-screen size.
    const scaleOf = (element: Element) =>
      element.parentElement?.getAttribute("transform");

    it("keeps hint arrows and point-markers the same size on screen", () => {
      renderMap({ guesses: [wrong("France", 8000, "SW")], showGeoHints: true });

      expect(scaleOf(screen.getByTestId("map-hint-arrow-FR"))).toBe("scale(1)");
      expect(scaleOf(target("Monaco"))).toBe("scale(1)");

      zoomTo(4);

      expect(scaleOf(screen.getByTestId("map-hint-arrow-FR"))).toBe(
        "scale(0.25)",
      );
      expect(scaleOf(target("Monaco"))).toBe("scale(0.25)");
    });

    it("bounds panning to the world, so the map can't be dragged off screen", () => {
      renderMap();

      // The map's own viewBox: d3-zoom measures its extent from the same box,
      // so matching it means the viewport can never leave the world.
      expect(screen.getByTestId("zoomable-group")).toHaveAttribute(
        "data-translate-extent",
        JSON.stringify([
          [0, 0],
          [800, 400],
        ]),
      );
    });

    it("keeps country outlines hairline-thin as the map zooms in", () => {
      renderMap();
      const widthAtRest = Number(target("France").getAttribute("stroke-width"));

      zoomTo(4);

      expect(Number(target("France").getAttribute("stroke-width"))).toBeCloseTo(
        widthAtRest / 4,
      );
    });
  });

  describe("answer reveal", () => {
    it("fills the answered country on a correct guess", () => {
      renderMap({
        guesses: [{ country: "Brazil", correct: true }],
        finished: true,
      });

      expect(stateOf("Brazil")).toBe("correct");
    });

    it("highlights the answer when the attempts run out", () => {
      renderMap({ guesses: [wrong("France", 8000, "SW")], finished: true });

      expect(stateOf("Brazil")).toBe("answer");
      expect(stateOf("France")).toBe("wrong");
    });

    it("stops accepting guesses once the round has finished", async () => {
      renderMap({ guesses: [wrong("France", 8000, "SW")], finished: true });

      await userEvent.click(target("Australia"));

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("stops previewing countries once the round has finished", () => {
      renderMap({ guesses: [wrong("France", 8000, "SW")], finished: true });

      fireEvent.mouseEnter(target("Australia"));

      expect(screen.queryByText("Australia")).not.toBeInTheDocument();
    });
  });
});
