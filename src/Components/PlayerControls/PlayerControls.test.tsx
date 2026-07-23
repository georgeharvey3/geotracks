import React from "react";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import PlayerControls from "./PlayerControls";

const createDefaultProps = (
  overrides: Partial<React.ComponentProps<typeof PlayerControls>> = {},
) => ({
  songReady: true,
  songLoadFailed: false,
  songFinished: false,
  songPlaying: false,
  onRetryLoad: vi.fn(),
  onPlayClicked: vi.fn(),
  ...overrides,
});

describe("PlayerControls", () => {
  it("renders the play button when ready and not playing", () => {
    render(<PlayerControls {...createDefaultProps({ songPlaying: false })} />);
    expect(screen.getByTestId("PlayArrowIcon")).toBeInTheDocument();
  });

  it("renders the pause button when playing", () => {
    render(<PlayerControls {...createDefaultProps({ songPlaying: true })} />);
    expect(screen.getByTestId("PauseIcon")).toBeInTheDocument();
  });

  it("renders the replay button when finished", () => {
    render(<PlayerControls {...createDefaultProps({ songFinished: true })} />);
    expect(screen.getByTestId("ReplayIcon")).toBeInTheDocument();
  });

  it("renders a loading spinner when the song is not ready", () => {
    render(<PlayerControls {...createDefaultProps({ songReady: false })} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("disables the play button when the song is not ready", () => {
    render(<PlayerControls {...createDefaultProps({ songReady: false })} />);
    const button = screen.getByRole("progressbar").closest("button")!;
    expect(button).toBeDisabled();
  });

  it("calls onPlayClicked when the play button is clicked", async () => {
    const onPlayClicked = vi.fn();
    render(<PlayerControls {...createDefaultProps({ onPlayClicked })} />);
    await userEvent.click(
      screen.getByTestId("PlayArrowIcon").closest("button")!,
    );
    expect(onPlayClicked).toHaveBeenCalledTimes(1);
  });

  describe("when the song fails to load", () => {
    it("shows the failure message and a retry button instead of playback controls", () => {
      render(
        <PlayerControls {...createDefaultProps({ songLoadFailed: true })} />,
      );
      expect(screen.getByText("Song failed to load")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("PlayArrowIcon")).not.toBeInTheDocument();
    });

    it("calls onRetryLoad when the retry button is clicked", async () => {
      const onRetryLoad = vi.fn();
      render(
        <PlayerControls
          {...createDefaultProps({ songLoadFailed: true, onRetryLoad })}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(onRetryLoad).toHaveBeenCalledTimes(1);
    });
  });
});
