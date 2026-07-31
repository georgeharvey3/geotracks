import { vi } from "vitest";

import { render, screen } from "../../test-utils";
import RunSummaryMap from "./RunSummaryMap";
import { MAP_FILLS, OUTCOME_FILLS } from "../../map/fills";
import { TurnOutcome, TurnResult } from "../../types";

// d3-zoom cannot run in jsdom; the rest of the map is the real library.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("../../test/zoomableGroupFake")).default,
}));

function turn(country: string, outcome: TurnOutcome): TurnResult {
  return {
    song: {
      country,
      link: `https://open.spotify.com/track/${country}-${outcome}`,
      album: `${country} Album`,
    },
    outcome,
    attempts: outcome === "named-first" ? 1 : 5,
    points: outcome === "named-first" ? 150 : 0,
    geoHintsUsed: false,
  };
}

describe("RunSummaryMap", () => {
  it("marks each answer country by its Turn outcome", async () => {
    render(
      <RunSummaryMap
        turns={[
          turn("France", "named-first"),
          turn("Japan", "named-later"),
          turn("Peru", "missed"),
        ]}
        highlightedCountry={null}
      />,
    );

    // The world's ~250 shapes are drawn a tick after mount.
    const france = await screen.findByLabelText("France");
    expect(france).toHaveAttribute("data-run-outcome", "named-first");
    expect(france).toHaveAttribute("fill", OUTCOME_FILLS["named-first"]);
    expect(screen.getByLabelText("Japan")).toHaveAttribute(
      "fill",
      OUTCOME_FILLS["named-later"],
    );
    expect(screen.getByLabelText("Peru")).toHaveAttribute(
      "fill",
      OUTCOME_FILLS.missed,
    );
  });

  it("leaves a country the Run never asked for unmarked", async () => {
    render(
      <RunSummaryMap
        turns={[turn("France", "named-first")]}
        highlightedCountry={null}
      />,
    );

    const japan = await screen.findByLabelText("Japan");
    expect(japan).not.toHaveAttribute("data-run-outcome");
    expect(japan).toHaveAttribute("fill", MAP_FILLS.inertLand);
  });

  it("draws a country that answered twice as its better turn", async () => {
    // A Run can ask for one country twice: the daily seed splices out the Album,
    // not the country. The rows stay the record of the two turns; the shape can
    // only carry one mark, and carries the better of them.
    render(
      <RunSummaryMap
        turns={[turn("Germany", "missed"), turn("Germany", "named-later")]}
        highlightedCountry={null}
      />,
    );

    const germany = await screen.findByLabelText("Germany");
    expect(germany).toHaveAttribute("data-run-outcome", "named-later");
    expect(germany).toHaveAttribute("fill", OUTCOME_FILLS["named-later"]);
  });

  it("offers the pointer no invitation to click anything", async () => {
    render(
      <RunSummaryMap
        turns={[turn("France", "named-first")]}
        highlightedCountry={null}
      />,
    );

    // A finished Run has nothing left to choose, answer country or not.
    expect(await screen.findByLabelText("France")).toHaveStyle(
      "cursor: default",
    );
    expect(screen.getByLabelText("Japan")).toHaveStyle("cursor: default");
  });

  it("lights the country a caller points at", async () => {
    render(
      <RunSummaryMap
        turns={[turn("France", "named-first")]}
        highlightedCountry="France"
      />,
    );

    expect(await screen.findByLabelText("France")).toHaveAttribute(
      "fill",
      MAP_FILLS.highlight,
    );
  });

  // The other two app surfaces arrive by lifting the night off the map, because
  // they are reached from a page standing on it in the dark. This one is reached
  // from the game screen — the same map, already revealed — so a veil here would
  // mean darkening the world in order to uncover it.
  it("does not veil a map that is already showing", async () => {
    render(
      <RunSummaryMap
        turns={[turn("France", "named-first")]}
        highlightedCountry={null}
      />,
    );
    await screen.findByLabelText("France");

    expect(screen.queryByTestId("map-veil")).not.toBeInTheDocument();
  });
});
