import userEvent from "@testing-library/user-event";

import { render, screen } from "../../test-utils";
import Guesses from "./Guesses";
import { Guess } from "../../types";

describe("Guesses", () => {
  it("renders a correct guess with country name", () => {
    const guesses: Guess[] = [{ country: "France", correct: true }];
    render(
      <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
    );
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
  });

  it("renders an incorrect guess with cross icon", () => {
    const guesses: Guess[] = [
      { country: "Germany", correct: false, distance: 500, direction: "NE" },
    ];
    render(
      <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
    );
    expect(screen.getByText("Germany")).toBeInTheDocument();
    expect(screen.getByTestId("CancelIcon")).toBeInTheDocument();
  });

  it("shows distance and direction when showGeoHints is true", () => {
    const guesses: Guess[] = [
      { country: "Spain", correct: false, distance: 1234.56, direction: "SW" },
    ];
    render(<Guesses guesses={guesses} showGeoHints={true} roundOver={false} />);
    expect(screen.getByText("1235 km")).toBeInTheDocument();
    expect(screen.getByTestId("SouthWestIcon")).toBeInTheDocument();
  });

  it("hides distance and direction when showGeoHints is false", () => {
    const guesses: Guess[] = [
      { country: "Spain", correct: false, distance: 1234, direction: "SW" },
    ];
    render(
      <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
    );
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("SouthWestIcon")).not.toBeInTheDocument();
  });

  describe("with several guesses", () => {
    const guesses: Guess[] = [
      { country: "Brazil", correct: false, distance: 8000, direction: "S" },
      { country: "Argentina", correct: false, distance: 3000, direction: "N" },
      { country: "Colombia", correct: false, distance: 1000, direction: "N" },
    ];

    it("shows only the latest guess until expanded", () => {
      render(
        <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
      );
      expect(screen.getByText("Colombia")).toBeInTheDocument();
      expect(screen.queryByText("Brazil")).not.toBeInTheDocument();
      expect(screen.queryByText("Argentina")).not.toBeInTheDocument();
    });

    it("shows every guess once expanded, and hides them again", async () => {
      render(
        <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /2 earlier guesses/i }),
      );
      expect(screen.getByText("Brazil")).toBeInTheDocument();
      expect(screen.getByText("Argentina")).toBeInTheDocument();
      expect(screen.getByText("Colombia")).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /hide earlier guesses/i }),
      );
      expect(screen.queryByText("Brazil")).not.toBeInTheDocument();
    });

    it("collapses again when the round ends", async () => {
      const { rerender } = render(
        <Guesses guesses={guesses} showGeoHints={false} roundOver={false} />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /2 earlier guesses/i }),
      );
      expect(screen.getByText("Brazil")).toBeInTheDocument();

      rerender(
        <Guesses guesses={guesses} showGeoHints={false} roundOver={true} />,
      );
      expect(screen.queryByText("Brazil")).not.toBeInTheDocument();
      expect(screen.getByText("Colombia")).toBeInTheDocument();
    });
  });
});
