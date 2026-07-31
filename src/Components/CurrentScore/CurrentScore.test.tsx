import { readsAs, render, screen } from "../../test-utils";
import CurrentScore from "./CurrentScore";

describe("CurrentScore", () => {
  // The plaque counts *up* to ten while the reducer counts down, so the turn
  // shown is the one being played rather than the number still to come.
  it("shows the turn being played, out of ten", () => {
    render(<CurrentScore turnsRemaining={7} score={0} />);
    expect(screen.getByText("Turn")).toBeInTheDocument();
    expect(screen.getByText(readsAs("4/10"))).toBeInTheDocument();
  });

  it("opens on turn 1 and closes on turn 10", () => {
    const { rerender } = render(<CurrentScore turnsRemaining={10} score={0} />);
    expect(screen.getByText(readsAs("1/10"))).toBeInTheDocument();

    rerender(<CurrentScore turnsRemaining={1} score={0} />);
    expect(screen.getByText(readsAs("10/10"))).toBeInTheDocument();

    // The last turn is retired before the Run summary replaces this screen;
    // the plaque holds at ten rather than counting on to eleven.
    rerender(<CurrentScore turnsRemaining={0} score={0} />);
    expect(screen.getByText(readsAs("10/10"))).toBeInTheDocument();
  });

  it("displays the current score", () => {
    render(<CurrentScore turnsRemaining={5} score={310} />);
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("310")).toBeInTheDocument();
  });

  it("updates when props change", () => {
    const { rerender } = render(<CurrentScore turnsRemaining={10} score={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();

    rerender(<CurrentScore turnsRemaining={3} score={450} />);
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText(readsAs("8/10"))).toBeInTheDocument();
  });
});
