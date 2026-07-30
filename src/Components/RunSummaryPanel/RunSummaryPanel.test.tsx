import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import RunSummaryPanel from "./RunSummaryPanel";
import { TurnResult } from "../../types";

function turn(overrides: Partial<TurnResult> = {}): TurnResult {
  return {
    song: {
      country: "France",
      link: "https://open.spotify.com/track/abc",
      album: "Test Album",
      trackTitle: "Test Track",
      artistName: "Test Artist",
    },
    outcome: "named-first",
    attempts: 1,
    points: 150,
    geoHintsUsed: false,
    ...overrides,
  };
}

describe("RunSummaryPanel", () => {
  const defaultProps = {
    score: 750,
    turns: [turn()],
    nameInputValue: "",
    onNameInputChange: vi.fn(),
    onScoreFormSubmit: vi.fn(),
    saving: false,
    saved: false,
    saveFailed: false,
    onShowLeaderboard: vi.fn(),
    onRowHoverChange: vi.fn(),
  };

  it("displays the score", () => {
    render(<RunSummaryPanel {...defaultProps} />);
    expect(screen.getByText("750 points")).toBeInTheDocument();
  });

  it("counts the turns the player named, out of ten", () => {
    render(
      <RunSummaryPanel
        {...defaultProps}
        turns={[
          turn(),
          turn({ outcome: "named-later", attempts: 3, points: 60 }),
          turn({ outcome: "missed", attempts: 5, points: 0 }),
        ]}
      />,
    );
    expect(screen.getByText("2 of 10 named")).toBeInTheDocument();
  });

  it("shows one row per turn of the Run", () => {
    render(
      <RunSummaryPanel {...defaultProps} turns={[turn(), turn(), turn()]} />,
    );
    expect(screen.getAllByText("Test Track")).toHaveLength(3);
  });

  it("renders the name input with placeholder", () => {
    render(<RunSummaryPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText("Name...")).toBeInTheDocument();
  });

  it("shows the current name input value", () => {
    render(<RunSummaryPanel {...defaultProps} nameInputValue="Player1" />);
    expect(screen.getByDisplayValue("Player1")).toBeInTheDocument();
  });

  it("calls onNameInputChange when typing", async () => {
    const onNameInputChange = vi.fn();
    render(
      <RunSummaryPanel
        {...defaultProps}
        onNameInputChange={onNameInputChange}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Name..."), "A");
    expect(onNameInputChange).toHaveBeenCalled();
  });

  it("disables Save button when name is empty", () => {
    render(<RunSummaryPanel {...defaultProps} nameInputValue="" />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("enables Save button when name has content", () => {
    render(<RunSummaryPanel {...defaultProps} nameInputValue="Test" />);
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("disables Save while the write is in flight", () => {
    render(<RunSummaryPanel {...defaultProps} nameInputValue="Test" saving />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("replaces the name box with a confirmation and a way to the leaderboard", () => {
    render(<RunSummaryPanel {...defaultProps} nameInputValue="Ada" saved />);
    expect(screen.getByText("Saved as Ada")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Name...")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Leaderboard/i }),
    ).toBeInTheDocument();
  });

  it("offers another attempt when the write fails", () => {
    render(
      <RunSummaryPanel {...defaultProps} nameInputValue="Ada" saveFailed />,
    );
    expect(screen.getByText(/Try again/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });
});
