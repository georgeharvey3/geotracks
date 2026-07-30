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

  it("calls setGameMode with competition when Competition button clicked", async () => {
    const setGameMode = vi.fn();
    render(<Menu {...createDefaultProps({ setGameMode })} />);
    await userEvent.click(screen.getByText("Competition Mode"));
    expect(setGameMode).toHaveBeenCalledWith("competition");
  });

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
