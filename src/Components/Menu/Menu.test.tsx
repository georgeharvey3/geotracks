import React from "react";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import Menu from "./Menu";

const gameModes = { infinite: "infinite", competition: "competition" };

const createDefaultProps = (
  overrides: Partial<React.ComponentProps<typeof Menu>> = {},
) => ({
  gameModes,
  setGameMode: vi.fn(),
  dailyRunStatus: "none" as const,
  onDailyRun: vi.fn(),
  setShowScoreboard: vi.fn(),
  setShowExplore: vi.fn(),
  ...overrides,
});

describe("Menu", () => {
  it("renders all four buttons", () => {
    render(<Menu {...createDefaultProps()} />);
    expect(screen.getByText("Competition Mode")).toBeInTheDocument();
    expect(screen.getByText("Infinite Mode")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Scoreboard")).toBeInTheDocument();
  });

  // One control in three states of the day's record, so the label is the only
  // thing that moves.
  it.each([
    ["none", "Competition Mode"],
    ["in-progress", "Resume today's Run"],
    ["finished", "Today's Run"],
  ] as const)("offers %s as '%s'", (dailyRunStatus, label) => {
    render(<Menu {...createDefaultProps({ dailyRunStatus })} />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });

  it.each(["none", "in-progress", "finished"] as const)(
    "calls onDailyRun from the Competition button when the day is %s",
    async (dailyRunStatus) => {
      const onDailyRun = vi.fn();
      render(<Menu {...createDefaultProps({ dailyRunStatus, onDailyRun })} />);
      await userEvent.click(
        screen.getByRole("button", { name: /Competition Mode|Run/ }),
      );
      expect(onDailyRun).toHaveBeenCalled();
    },
  );

  it("calls setGameMode with infinite when Infinite button clicked", async () => {
    const setGameMode = vi.fn();
    render(<Menu {...createDefaultProps({ setGameMode })} />);
    await userEvent.click(screen.getByText("Infinite Mode"));
    expect(setGameMode).toHaveBeenCalledWith("infinite");
  });

  it("calls setShowExplore when Explore button clicked", async () => {
    const setShowExplore = vi.fn();
    render(<Menu {...createDefaultProps({ setShowExplore })} />);
    await userEvent.click(screen.getByText("Explore"));
    expect(setShowExplore).toHaveBeenCalled();
  });

  it("calls setShowScoreboard when Scoreboard button clicked", async () => {
    const setShowScoreboard = vi.fn();
    render(<Menu {...createDefaultProps({ setShowScoreboard })} />);
    await userEvent.click(screen.getByText("Scoreboard"));
    expect(setShowScoreboard).toHaveBeenCalledWith(true);
  });
});
