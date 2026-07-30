import { vi } from "vitest";

import { fireEvent, render, screen } from "../../test-utils";
import RunSummary from "./RunSummary";
import { MAP_FILLS, OUTCOME_FILLS } from "../../map/fills";
import { setHoverCapability } from "../../test/hoverCapability";
import { TurnResult } from "../../types";

// d3-zoom cannot run in jsdom; the rest of the map is the real library.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("../../test/zoomableGroupFake")).default,
}));

function turn(
  country: string,
  overrides: Partial<TurnResult> = {},
): TurnResult {
  return {
    song: {
      country,
      link: `https://open.spotify.com/track/${country}`,
      album: `${country} Album`,
    },
    outcome: "named-first",
    attempts: 1,
    points: 150,
    geoHintsUsed: false,
    ...overrides,
  };
}

const defaultProps = {
  score: 300,
  turns: [turn("France"), turn("Japan", { outcome: "missed", points: 0 })],
  nameInputValue: "",
  onNameInputChange: vi.fn(),
  onScoreFormSubmit: vi.fn(),
  saving: false,
  saved: false,
  saveFailed: false,
  onShowLeaderboard: vi.fn(),
};

/** The row for a turn, reached through the country it names. */
const row = (turnNumber: number, country: string) =>
  screen
    .getByText(`${turnNumber}. ${country}`)
    .closest("[data-turn-outcome]") as HTMLElement;

describe("RunSummary", () => {
  it("lights a row's country on the map while the pointer is on the row", async () => {
    render(<RunSummary {...defaultProps} />);
    // The world's ~250 shapes are drawn a tick after the screen mounts.
    const france = await screen.findByLabelText("France");
    expect(france).toHaveAttribute("fill", OUTCOME_FILLS["named-first"]);

    // fireEvent, as the map's own hover tests do: a hover update is low priority
    // and userEvent's act does not settle it before the assertion.
    fireEvent.mouseEnter(row(1, "France"));
    expect(france).toHaveAttribute("fill", MAP_FILLS.highlight);

    fireEvent.mouseLeave(row(1, "France"));
    expect(france).toHaveAttribute("fill", OUTCOME_FILLS["named-first"]);
  });

  it("leaves the map alone on a device with no hovering pointer", async () => {
    setHoverCapability(false);
    render(<RunSummary {...defaultProps} />);
    const france = await screen.findByLabelText("France");

    // Nothing to light: the country printed in the row does that job instead.
    fireEvent.mouseEnter(row(1, "France"));
    expect(france).toHaveAttribute("fill", OUTCOME_FILLS["named-first"]);
  });
});
