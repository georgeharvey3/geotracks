import { render, screen } from "../../test-utils";
import Base from "./Base";

describe("Base", () => {
  // The wordmark sets one letter in the accent colour, so it is several text
  // nodes; what matters is that it still reads as the one word.
  it("renders the GeoTracks title", () => {
    render(
      <Base showMenuButton={false} onMenuClicked={vi.fn()}>
        <div>Child</div>
      </Base>,
    );
    expect(
      screen.getByRole("heading", { name: "GeoTracks" }),
    ).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <Base showMenuButton={false} onMenuClicked={vi.fn()}>
        <div>Test Child Content</div>
      </Base>,
    );
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  it("shows the home button when showMenuButton is true", () => {
    render(
      <Base showMenuButton={true} onMenuClicked={vi.fn()}>
        <div>Child</div>
      </Base>,
    );
    expect(screen.getByTestId("HomeIcon")).toBeInTheDocument();
  });

  it("hides the home button when showMenuButton is false", () => {
    render(
      <Base showMenuButton={false} onMenuClicked={vi.fn()}>
        <div>Child</div>
      </Base>,
    );
    expect(screen.queryByTestId("HomeIcon")).not.toBeInTheDocument();
  });

  it("calls onMenuClicked when the home button is clicked", () => {
    const onMenuClicked = vi.fn();
    render(
      <Base showMenuButton={true} onMenuClicked={onMenuClicked}>
        <div>Child</div>
      </Base>,
    );
    screen.getByTestId("HomeIcon").closest("button")!.click();
    expect(onMenuClicked).toHaveBeenCalledTimes(1);
  });
});
