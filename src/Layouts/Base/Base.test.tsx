import { StrictMode } from "react";
import { vi } from "vitest";

import { render, screen } from "../../test-utils";
import Base from "./Base";

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

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

  // The content pages stand on the night backdrop and draw their chrome in
  // paper; the map surfaces are cream, so only one of them says so.
  it("marks the content page as a night surface and the map surface not", () => {
    const { container, rerender } = render(
      <Base showMenuButton={false} onMenuClicked={vi.fn()}>
        <div>Child</div>
      </Base>,
    );
    expect(container.querySelector('[data-surface="night"]')).not.toBeNull();

    rerender(
      <Base showMenuButton={false} fullBleed onMenuClicked={vi.fn()}>
        <div>Child</div>
      </Base>,
    );
    expect(container.querySelector('[data-surface="night"]')).toBeNull();
  });

  describe("the wordmark's glide", () => {
    // jsdom implements no Web Animations API and measures every box as zero,
    // and the glide is built to do nothing without either — so a test of it has
    // to supply both. `animate` is installed rather than spied on, since there
    // is nothing there to spy on.
    const stubGlide = () => {
      const animate = vi.fn(
        (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => ({
          cancel: vi.fn(),
        }),
      );
      (Element.prototype as unknown as Record<string, unknown>).animate =
        animate;
      return {
        animate,
        measure: vi.spyOn(Element.prototype, "getBoundingClientRect"),
      };
    };

    afterEach(() => {
      delete (Element.prototype as unknown as Record<string, unknown>).animate;
      vi.restoreAllMocks();
    });

    it("draws the new wordmark where the old one was, then releases it", () => {
      const { animate, measure } = stubGlide();

      measure.mockReturnValue(rect(100, 40, 200, 50));
      const { unmount } = render(
        <Base showMenuButton={false} screenKey="menu" onMenuClicked={vi.fn()}>
          <div>Child</div>
        </Base>,
      );
      unmount();
      // However the wordmark arrived on that page is not what is under test.
      animate.mockClear();

      // The game's chrome: smaller, and up in the corner.
      measure.mockReturnValue(rect(40, 10, 120, 30));
      render(
        <Base
          showMenuButton
          fullBleed
          screenKey="playing"
          onMenuClicked={vi.fn()}
        >
          <div>Child</div>
        </Base>,
      );

      expect(animate).toHaveBeenCalledTimes(1);
      const frames = animate.mock.calls[0]![0];
      // 200/120 wide, 60px to the right of and 30px below where it lands.
      expect(frames[0]!.transform).toMatch(
        /^translate\(60px, 30px\) scale\(1\.66/,
      );
      expect(frames[1]!.transform).toBe("none");
    });

    it("stays put when the screen it arrives on puts it in the same place", () => {
      const { animate, measure } = stubGlide();

      measure.mockReturnValue(rect(100, 40, 200, 50));
      const { unmount } = render(
        <Base showMenuButton={false} screenKey="menu" onMenuClicked={vi.fn()}>
          <div>Child</div>
        </Base>,
      );
      unmount();
      // Whatever the wordmark did to arrive on that page is not what is under
      // test; the next arrival is.
      animate.mockClear();

      render(
        <Base showMenuButton screenKey="scoreboard" onMenuClicked={vi.fn()}>
          <div>Child</div>
        </Base>,
      );

      expect(animate).not.toHaveBeenCalled();
    });

    // The app is mounted inside StrictMode, which runs a layout effect twice on
    // mount and cleans up in between — cancelling the flight within a frame. It
    // is the whole app that is wrapped, so this is the only mode the glide is
    // ever seen in during development.
    it("makes the same flight again when StrictMode cancels the first", () => {
      const { animate, measure } = stubGlide();

      measure.mockReturnValue(rect(100, 40, 200, 50));
      const { unmount } = render(
        <StrictMode>
          <Base showMenuButton={false} screenKey="menu" onMenuClicked={vi.fn()}>
            <div>Child</div>
          </Base>
        </StrictMode>,
      );
      unmount();
      animate.mockClear();

      measure.mockReturnValue(rect(40, 10, 120, 30));
      render(
        <StrictMode>
          <Base
            showMenuButton
            fullBleed
            screenKey="playing"
            onMenuClicked={vi.fn()}
          >
            <div>Child</div>
          </Base>
        </StrictMode>,
      );

      // Whatever it was asked to do, one flight has to be left flying — and it
      // has to be the same flight, not the destination measured against itself.
      const flying = animate.mock.results.filter(
        (result) => result.value.cancel.mock.calls.length === 0,
      );
      expect(flying).toHaveLength(1);
      const frames = animate.mock.calls.at(-1)![0];
      expect(frames[0]!.transform).toMatch(
        /^translate\(60px, 30px\) scale\(1\.66/,
      );
    });
  });
});
