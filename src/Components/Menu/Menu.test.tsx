import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import Menu from "./Menu";

const gameModes = { infinite: "infinite", competition: "competition" };

describe("Menu", () => {
  it("renders all three buttons", () => {
    render(
      <Menu
        gameModes={gameModes}
        setGameMode={vi.fn()}
        setShowScoreboard={vi.fn()}
      />,
    );
    expect(screen.getByText("Competition Mode")).toBeInTheDocument();
    expect(screen.getByText("Infinite Mode")).toBeInTheDocument();
    expect(screen.getByText("Scoreboard")).toBeInTheDocument();
  });

  it("calls setGameMode with competition when Competition button clicked", async () => {
    const setGameMode = vi.fn();
    render(
      <Menu
        gameModes={gameModes}
        setGameMode={setGameMode}
        setShowScoreboard={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("Competition Mode"));
    expect(setGameMode).toHaveBeenCalledWith("competition");
  });

  it("calls setGameMode with infinite when Infinite button clicked", async () => {
    const setGameMode = vi.fn();
    render(
      <Menu
        gameModes={gameModes}
        setGameMode={setGameMode}
        setShowScoreboard={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("Infinite Mode"));
    expect(setGameMode).toHaveBeenCalledWith("infinite");
  });

  it("calls setShowScoreboard when Scoreboard button clicked", async () => {
    const setShowScoreboard = vi.fn();
    render(
      <Menu
        gameModes={gameModes}
        setGameMode={vi.fn()}
        setShowScoreboard={setShowScoreboard}
      />,
    );
    await userEvent.click(screen.getByText("Scoreboard"));
    expect(setShowScoreboard).toHaveBeenCalledWith(true);
  });
});
