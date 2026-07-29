import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import getDailySongs from "./helpers/getDailySongs";
import albumsJSON from "./albums.json";
import countriesJSON from "./countries.json";
import { Album } from "./types";
import { spotifyPlayerControl } from "./test/spotifyPlayerFake";
import { leaderboardControl } from "./test/leaderboardFake";

// Integration tests mount the real <App> (real reducer, context, routing and
// keyboard shortcuts) and mock ONLY the two side-effectful seams: the Spotify
// player and the leaderboard. No iframe, no network, no MSW.
vi.mock("./hooks/useSpotifyPlayer", () => import("./test/spotifyPlayerFake"));
vi.mock("./hooks/useLeaderboard", () => import("./test/leaderboardFake"));

// The map's pan/zoom wrapper is the one part jsdom cannot run (d3-zoom); the
// rest of the map is real, so map guesses go through the real guess pipeline.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("./test/zoomableGroupFake")).default,
}));

// The reducer seeds each round from getDailySongs(albums); compute the same
// deterministic daily set here so tests know the correct answer per round.
const dailySongs = getDailySongs(albumsJSON as Album[]);
const answerAt = (round: number) => dailySongs[round]!.country;

const allCountryNames = countriesJSON.map((c) => c.name);
function wrongCountriesFor(answer: string, count: number): string[] {
  return allCountryNames
    .filter((name) => name.toLowerCase() !== answer.toLowerCase())
    .slice(0, count);
}

const DIRECTION_TESTIDS = [
  "NorthIcon",
  "NorthEastIcon",
  "EastIcon",
  "SouthEastIcon",
  "SouthIcon",
  "SouthWestIcon",
  "WestIcon",
  "NorthWestIcon",
];
const hasDirectionIcon = () =>
  DIRECTION_TESTIDS.some((id) => screen.queryByTestId(id) !== null);

async function startInfinite() {
  await userEvent.click(screen.getByRole("button", { name: /Infinite Mode/i }));
}

async function startCompetition() {
  await userEvent.click(
    screen.getByRole("button", { name: /Competition Mode/i }),
  );
}

async function submitGuess(country: string) {
  const input = screen.getByPlaceholderText("Country");
  await userEvent.clear(input);
  await userEvent.type(input, country);
  const submitButton = screen
    .getAllByRole("button")
    .find((b) => b.getAttribute("type") === "submit")!;
  await userEvent.click(submitButton);
}

// The map's clickable target for a country — its polygon, or its point-marker
// when the country is too small to draw one.
const mapTarget = (country: string) => screen.getByLabelText(country);

async function guessOnMap(country: string) {
  await userEvent.click(mapTarget(country));
}

const playButton = () => screen.getByTestId("PlayArrowIcon").closest("button")!;
const homeButton = () => screen.getByTestId("HomeIcon").closest("button")!;

beforeEach(() => {
  spotifyPlayerControl.reset();
  leaderboardControl.reset();
});

describe("App integration", () => {
  describe("menu and navigation", () => {
    it("shows the title and mode buttons on the menu", () => {
      render(<App />);
      expect(screen.getByText("GeoTracks")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Competition Mode/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Scoreboard/i }),
      ).toBeInTheDocument();
    });

    it("starts an infinite game from the menu", async () => {
      render(<App />);
      await startInfinite();
      expect(
        screen.getByText("Which country does this song originate from?"),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Country")).toBeInTheDocument();
      expect(screen.getByLabelText("GeoHints")).toBeInTheDocument();
    });

    it("opens the scoreboard and returns to the menu", async () => {
      leaderboardControl.setScores([
        { name: "Ada", score: 999 },
        { name: "Bob", score: 500 },
      ]);
      render(<App />);
      await userEvent.click(
        screen.getByRole("button", { name: /Scoreboard/i }),
      );

      expect(screen.getByText("Top Scores")).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("Ada")).toBeInTheDocument();
      expect(screen.getByText("999")).toBeInTheDocument();

      await userEvent.click(homeButton());
      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
    });

    it("returns to the menu from a game via the home button", async () => {
      render(<App />);
      await startInfinite();
      expect(
        screen.getByText("Which country does this song originate from?"),
      ).toBeInTheDocument();

      await userEvent.click(homeButton());
      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
    });
  });

  describe("playback", () => {
    it("enables the play button when the clip becomes ready", async () => {
      render(<App />);
      await startInfinite();

      // Before ready the control shows a loading spinner (no play icon).
      expect(screen.queryByTestId("PlayArrowIcon")).not.toBeInTheDocument();

      act(() => spotifyPlayerControl.emitReady());
      expect(playButton()).not.toBeDisabled();
    });

    it("toggles play/pause via the play button", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      await userEvent.click(playButton());
      expect(spotifyPlayerControl.onPlayClicked).toHaveBeenCalled();
      expect(screen.getByTestId("PauseIcon")).toBeInTheDocument();

      await userEvent.click(screen.getByTestId("PauseIcon").closest("button")!);
      expect(screen.getByTestId("PlayArrowIcon")).toBeInTheDocument();
    });

    it("toggles playback with the Space key when the input is unfocused", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      fireEvent.keyPress(document, { key: " ", charCode: 32 });
      expect(spotifyPlayerControl.onPlayClicked).toHaveBeenCalled();
      expect(screen.getByTestId("PauseIcon")).toBeInTheDocument();
    });

    it("shows a retry fallback on load failure and recovers", async () => {
      render(<App />);
      await startInfinite();

      act(() => spotifyPlayerControl.emitLoadFailure());
      expect(screen.getByText("Song failed to load")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Retry/i }));
      expect(spotifyPlayerControl.onRetryLoad).toHaveBeenCalled();
      expect(screen.queryByText("Song failed to load")).not.toBeInTheDocument();

      act(() => spotifyPlayerControl.emitReady());
      expect(screen.getByTestId("PlayArrowIcon")).toBeInTheDocument();
    });
  });

  describe("guessing", () => {
    it("lists a wrong guess without finishing the round", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const wrong = wrongCountriesFor(answerAt(0), 1)[0]!;
      await submitGuess(wrong);

      expect(screen.getByText(wrong)).toBeInTheDocument();
      // Still able to keep guessing (round not finished).
      expect(screen.getByPlaceholderText("Country")).not.toBeDisabled();
      expect(screen.getByTestId("CancelIcon")).toBeInTheDocument();
    });

    it("shows distance and direction hints when GeoHints is enabled", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      await userEvent.click(screen.getByLabelText("GeoHints"));

      const wrong = wrongCountriesFor(answerAt(0), 1)[0]!;
      await submitGuess(wrong);

      // Once in the guess list, once on the map.
      expect(screen.getAllByText(/\d+\s*km/)).toHaveLength(2);
      expect(hasDirectionIcon()).toBe(true);
    });

    it("reveals the answer after five wrong guesses", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const answer = answerAt(0);
      for (const wrong of wrongCountriesFor(answer, 5)) {
        await submitGuess(wrong);
      }

      expect(screen.getByText(`Answer was: ${answer}`)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Next Song/i }),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Country")).toBeDisabled();
    });

    it("advances to a fresh round on Next Song", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      for (const wrong of wrongCountriesFor(answerAt(0), 5)) {
        await submitGuess(wrong);
      }
      await userEvent.click(screen.getByRole("button", { name: /Next Song/i }));

      // Back to a fresh round: no reveal text, input re-enabled.
      expect(screen.queryByText(/Answer was:/)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Country")).not.toBeDisabled();
    });

    it("plays a whole round from the map alone", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const answer = answerAt(0);
      const wrong = wrongCountriesFor(answer, 1)[0]!;

      await guessOnMap(wrong);
      expect(mapTarget(wrong)).toHaveAttribute("data-guess-state", "wrong");
      expect(screen.queryByRole("button", { name: /Next Song/i })).toBeNull();

      await guessOnMap(answer);
      expect(mapTarget(answer)).toHaveAttribute("data-guess-state", "correct");
      expect(
        screen.getByRole("button", { name: /Next Song/i }),
      ).toBeInTheDocument();
    });

    it("marks a typed guess on the map, and a map guess in the list", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const [typed, clicked] = wrongCountriesFor(answerAt(0), 2) as [
        string,
        string,
      ];

      await submitGuess(typed);
      expect(mapTarget(typed)).toHaveAttribute("data-guess-state", "wrong");

      await guessOnMap(clicked);
      // One shared board: both guesses are on the map, and the list — collapsed
      // to its latest entry — reports the one the map committed.
      expect(mapTarget(clicked)).toHaveAttribute("data-guess-state", "wrong");
      expect(mapTarget(typed)).toHaveAttribute("data-guess-state", "wrong");
      expect(screen.getByTestId("CancelIcon")).toBeInTheDocument();

      // The earlier typed guess is one tap away.
      await userEvent.click(
        screen.getByRole("button", { name: /1 earlier guess/i }),
      );
      expect(screen.getAllByTestId("CancelIcon")).toHaveLength(2);
    });

    it("reveals the answer on the map and stops taking guesses", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const answer = answerAt(0);
      const wrongs = wrongCountriesFor(answer, 5);
      for (const wrong of wrongs) {
        await guessOnMap(wrong);
      }

      expect(screen.getByText(`Answer was: ${answer}`)).toBeInTheDocument();
      expect(mapTarget(answer)).toHaveAttribute("data-guess-state", "answer");

      const extra = wrongCountriesFor(answer, 6)[5]!;
      await guessOnMap(extra);
      expect(mapTarget(extra)).not.toHaveAttribute("data-guess-state");
    });

    it("auto-focuses the country input when typing while unfocused", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const input = screen.getByPlaceholderText("Country");
      expect(input).not.toHaveFocus();

      fireEvent.keyPress(document, { key: "a", charCode: 97 });
      expect(input).toHaveFocus();
    });
  });

  describe("competition mode", () => {
    it("shows score and turns and the half-points warning", async () => {
      render(<App />);
      await startCompetition();

      expect(screen.getByText("Turns: 10")).toBeInTheDocument();
      expect(screen.getByText("Score: 0")).toBeInTheDocument();
      expect(
        screen.getByText("Enabling GeoHints will score half points"),
      ).toBeInTheDocument();
    });

    it("scores across turns and reaches the final score", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());

      // First-guess-correct on every turn = 150 * 10 = 1500.
      for (let turn = 0; turn < 10; turn += 1) {
        await submitGuess(answerAt(turn));
        expect(
          screen.getByText(`Score: ${(turn + 1) * 150}`),
        ).toBeInTheDocument();
        await userEvent.click(
          screen.getByRole("button", { name: /Next Song/i }),
        );
      }

      expect(screen.getByText("1500 points")).toBeInTheDocument();

      // Submitting the name hits the leaderboard seam (no network).
      const nameInput = screen.getByPlaceholderText("Name...");
      await userEvent.type(nameInput, "Ada");
      await userEvent.click(screen.getByRole("button", { name: /Save/i }));

      await waitFor(() =>
        expect(leaderboardControl.submitScore).toHaveBeenCalledWith(
          "Ada",
          1500,
        ),
      );
    });

    it("scores a map guess exactly like a typed one", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());

      await guessOnMap(answerAt(0));

      expect(screen.getByText("Score: 150")).toBeInTheDocument();
    });

    it("halves the score for the round when GeoHints is enabled", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());

      await userEvent.click(screen.getByLabelText("GeoHints"));
      await submitGuess(answerAt(0));

      // 150 base, halved to 75 because hints were enabled this round.
      expect(screen.getByText("Score: 75")).toBeInTheDocument();
    });
  });
});
