import React from "react";
import { readsAs, render, screen } from "../../test-utils";
import Game from "./Game";
import { Guess, Song } from "../../types";

const createDefaultProps = (
  overrides: Partial<React.ComponentProps<typeof Game>> = {},
) => ({
  songReady: true,
  songLoadFailed: false,
  onRetryLoad: vi.fn(),
  songFinished: false,
  onPlayClicked: vi.fn(),
  songPlaying: false,
  onFormSubmit: vi.fn(),
  finished: false,
  showGeoHints: false,
  onCheck: vi.fn(),
  errorMessage: "",
  submitted: false,
  guesses: [] as Guess[],
  onNextSongClicked: vi.fn(),
  onMapCommit: vi.fn(),
  song: {
    country: "France",
    link: "https://open.spotify.com/track/abc",
    album: "Test Album",
  } as Song,
  embedRef: React.createRef<HTMLDivElement>(),
  isCompetition: false,
  turnsRemaining: 10,
  score: 0,
  countryInputRef: React.createRef<HTMLInputElement>(),
  ...overrides,
});

describe("Game", () => {
  it("renders the question prompt", () => {
    render(<Game {...createDefaultProps()} />);
    expect(
      screen.getByText("Which country does this song originate from?"),
    ).toBeInTheDocument();
  });

  it("renders play button when song is ready and not playing", () => {
    render(
      <Game {...createDefaultProps({ songReady: true, songPlaying: false })} />,
    );
    expect(screen.getByTestId("PlayArrowIcon")).toBeInTheDocument();
  });

  it("renders pause button when song is playing", () => {
    render(
      <Game {...createDefaultProps({ songReady: true, songPlaying: true })} />,
    );
    expect(screen.getByTestId("PauseIcon")).toBeInTheDocument();
  });

  it("renders replay button when song is finished", () => {
    render(
      <Game {...createDefaultProps({ songReady: true, songFinished: true })} />,
    );
    expect(screen.getByTestId("ReplayIcon")).toBeInTheDocument();
  });

  it("renders loading spinner when song is not ready", () => {
    render(<Game {...createDefaultProps({ songReady: false })} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("disables play button when song is not ready", () => {
    render(<Game {...createDefaultProps({ songReady: false })} />);
    const button = screen.getByRole("progressbar").closest("button")!;
    expect(button).toBeDisabled();
  });

  it("shows Next Song button when finished", () => {
    render(<Game {...createDefaultProps({ finished: true })} />);
    expect(screen.getByText("Next Song")).toBeInTheDocument();
  });

  it("shows Continue when turnsRemaining is 0", () => {
    render(
      <Game {...createDefaultProps({ finished: true, turnsRemaining: 0 })} />,
    );
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("shows album name when finished", () => {
    render(<Game {...createDefaultProps({ finished: true })} />);
    expect(screen.getByText("Test Album")).toBeInTheDocument();
  });

  it("does not show Next Song button when not finished", () => {
    render(<Game {...createDefaultProps({ finished: false })} />);
    expect(screen.queryByText("Next Song")).not.toBeInTheDocument();
  });

  it("shows error message when present", () => {
    render(
      <Game
        {...createDefaultProps({ errorMessage: "Unrecognised country: 'XYZ'" })}
      />,
    );
    expect(screen.getByText("Unrecognised country: 'XYZ'")).toBeInTheDocument();
  });

  it("does not show error when empty", () => {
    render(<Game {...createDefaultProps({ errorMessage: "" })} />);
    expect(screen.queryByText(/Unrecognised/)).not.toBeInTheDocument();
  });

  it("shows CurrentScore in competition mode", () => {
    render(
      <Game
        {...createDefaultProps({
          isCompetition: true,
          turnsRemaining: 8,
          score: 230,
        })}
      />,
    );
    expect(screen.getByText(readsAs("3/10"))).toBeInTheDocument();
    expect(screen.getByText("230")).toBeInTheDocument();
  });

  it("does not show CurrentScore in infinite mode", () => {
    render(<Game {...createDefaultProps({ isCompetition: false })} />);
    expect(screen.queryByText("Turn")).not.toBeInTheDocument();
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
  });

  it("says what GeoHints cost in competition mode", () => {
    render(<Game {...createDefaultProps({ isCompetition: true })} />);
    expect(screen.getByText("half points")).toBeInTheDocument();
  });

  it("says nothing about the cost in infinite mode, where there is none", () => {
    render(<Game {...createDefaultProps({ isCompetition: false })} />);
    expect(screen.queryByText("half points")).not.toBeInTheDocument();
  });

  it("renders the GeoHints switch", () => {
    render(<Game {...createDefaultProps()} />);
    expect(screen.getByText("GeoHints")).toBeInTheDocument();
  });

  it("renders guesses when submitted", () => {
    const guesses: Guess[] = [
      { country: "Spain", correct: false, distance: 500, direction: "NE" },
    ];
    render(<Game {...createDefaultProps({ submitted: true, guesses })} />);
    expect(screen.getByText("Spain")).toBeInTheDocument();
  });

  it("does not render guesses when not submitted", () => {
    const guesses: Guess[] = [
      { country: "Spain", correct: false, distance: 500, direction: "NE" },
    ];
    render(<Game {...createDefaultProps({ submitted: false, guesses })} />);
    expect(screen.queryByText("Spain")).not.toBeInTheDocument();
  });
});
