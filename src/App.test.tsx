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

// The ten turns a Competition Run asks for today. The daily seed moves with the
// date, so nothing about today's ten may be hard-coded — including whether they
// are ten different countries.
const runTurns = Array.from({ length: 10 }, (_, turn) => answerAt(turn));

/** Countries no turn of this Run asks for: safe to guess wrongly, or to hover. */
function countriesOutsideTheRun(count: number): string[] {
  const inRun = new Set(runTurns.map((name) => name.toLowerCase()));
  return allCountryNames
    .filter((name) => !inRun.has(name.toLowerCase()))
    .slice(0, count);
}

/**
 * Turns whose country answers only once in this Run. The daily seed splices out
 * the Album, not the country, so a Run can ask for one country twice — and a
 * mark on the map then belongs to two turns, not one. Assertions that tie a
 * country to a single turn use these.
 */
function turnsWithSoleAnswers(count: number): number[] {
  return runTurns
    .map((_, turn) => turn)
    .filter(
      (turn) => runTurns.filter((name) => name === runTurns[turn]).length === 1,
    )
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

interface TurnPlan {
  /** Wrong guesses to make before naming the answer. */
  wrongGuesses?: number;
  /** Burn all five attempts without naming the answer. */
  miss?: boolean;
  /** Turn geo-hints on for the turn, halving its points. */
  hints?: boolean;
}

/**
 * Play one Competition turn to its end and retire it. Guesses go through the
 * map, the cheaper of the two inputs to drive — ten turns of typing re-renders
 * the world's ~250 shapes on every keystroke. Wrong guesses are drawn from
 * countries no turn of this Run asks for, so one can never be mistaken for
 * another turn's answer.
 */
async function playTurn(turn: number, plan: TurnPlan = {}) {
  if (plan.hints) await userEvent.click(screen.getByLabelText("GeoHints"));

  const wrongCount = plan.miss ? 5 : (plan.wrongGuesses ?? 0);
  for (const wrong of countriesOutsideTheRun(wrongCount)) {
    await guessOnMap(wrong);
  }
  if (!plan.miss) await guessOnMap(answerAt(turn));

  await userEvent.click(screen.getByRole("button", { name: /Next Song/i }));
}

/** Play a whole Competition Run, landing on the Run summary. */
async function playRun(plans: Record<number, TurnPlan> = {}) {
  render(<App />);
  await startCompetition();
  act(() => spotifyPlayerControl.emitReady());
  for (let turn = 0; turn < 10; turn += 1) {
    await playTurn(turn, plans[turn]);
  }
  // The world's ~250 shapes are drawn a tick after the screen mounts.
  await screen.findByLabelText(answerAt(0));
}

/** One Turn result row, found by the country it belongs to. */
const summaryRow = (turnNumber: number, country: string) =>
  screen
    .getByText(`${turnNumber}. ${country}`)
    .closest("[data-turn-outcome]") as HTMLElement;

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

    it("scores across turns and reaches the Run summary", async () => {
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

  describe("Run summary", () => {
    it("ends a Run on the score, the count, the name box and ten rows", async () => {
      await playRun();

      expect(screen.getByText("1500 points")).toBeInTheDocument();
      expect(screen.getByText("10 of 10 named")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Name...")).toBeInTheDocument();
      // One row per turn, each handing off to Spotify.
      expect(screen.getAllByRole("link", { name: /Spotify/i })).toHaveLength(
        10,
      );
      // No player mounts here: the rows identify the Songs, they don't play them.
      expect(screen.queryByTestId("PlayArrowIcon")).not.toBeInTheDocument();
    });

    it("names each Song where the metadata arrived, and says so where it didn't", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());
      // The first turn's oEmbed metadata lands while it is playing.
      act(() =>
        spotifyPlayerControl.setMetadata({
          trackTitle: "Turn One Track",
          artistName: "Turn One Artist",
        }),
      );
      for (let turn = 0; turn < 10; turn += 1) {
        await playTurn(turn);
      }
      await screen.findByLabelText(answerAt(0));

      const firstSong = dailySongs[0]!;
      const row = summaryRow(1, firstSong.country);
      expect(row).toHaveTextContent("Turn One Track");
      expect(row).toHaveTextContent("Turn One Artist");
      expect(row).toHaveTextContent(firstSong.album);
      expect(row.querySelector("a")).toHaveAttribute("href", firstSong.link);

      // The other nine Songs are still identified by country and Album.
      expect(screen.getAllByText("Unknown Track")).toHaveLength(9);
    });

    it("shows the outcome, the attempts it took and the points earned", async () => {
      await playRun({
        0: { hints: true },
        1: { wrongGuesses: 2 },
        2: { miss: true },
      });

      // 75 + 60 + 0 + seven clean turns.
      expect(screen.getByText("1185 points")).toBeInTheDocument();
      expect(screen.getByText("9 of 10 named")).toBeInTheDocument();

      const hinted = summaryRow(1, answerAt(0));
      expect(hinted).toHaveTextContent("Named first guess");
      expect(hinted).toHaveTextContent("75 pts");
      // The only thing that explains the halved figure.
      expect(hinted).toHaveTextContent("GeoHints");

      const later = summaryRow(2, answerAt(1));
      expect(later).toHaveTextContent("Named on guess 3");
      expect(later).toHaveTextContent("60 pts");

      // A missed turn still names the country the player never got.
      const missed = summaryRow(3, answerAt(2));
      expect(missed).toHaveTextContent("Missed in 5 guesses");
      expect(missed).toHaveTextContent("0 pts");

      expect(screen.getAllByText("Named first guess")).toHaveLength(8);
      // Hints were on for exactly one turn.
      expect(screen.getAllByText("GeoHints")).toHaveLength(1);
    });

    it("marks the answer countries on the map, and takes no guesses", async () => {
      // Turns whose country answers only once, so each mark belongs to one turn.
      const [first, later, missed] = turnsWithSoleAnswers(3) as [
        number,
        number,
        number,
      ];
      await playRun({ [later]: { wrongGuesses: 1 }, [missed]: { miss: true } });

      expect(mapTarget(answerAt(first))).toHaveAttribute(
        "data-run-outcome",
        "named-first",
      );
      expect(mapTarget(answerAt(later))).toHaveAttribute(
        "data-run-outcome",
        "named-later",
      );
      expect(mapTarget(answerAt(missed))).toHaveAttribute(
        "data-run-outcome",
        "missed",
      );

      // The Run's wrong guesses are not kept, and are not drawn.
      const [wrong] = countriesOutsideTheRun(1) as [string];
      expect(mapTarget(wrong)).not.toHaveAttribute("data-run-outcome");

      // Nothing here commits: clicking a country leaves the summary as it was.
      await userEvent.click(mapTarget(wrong));
      expect(mapTarget(wrong)).not.toHaveAttribute("data-guess-state");
      expect(screen.getByText("9 of 10 named")).toBeInTheDocument();

      // Hover still names every country, answer or not.
      fireEvent.mouseEnter(mapTarget(wrong));
      expect(screen.getByText(wrong)).toBeInTheDocument();
    });

    it("saves the score once, in place, without losing the recap", async () => {
      await playRun();

      await userEvent.type(screen.getByPlaceholderText("Name..."), "Ada");
      await userEvent.click(screen.getByRole("button", { name: /Save/i }));

      await waitFor(() =>
        expect(screen.getByText("Saved as Ada")).toBeInTheDocument(),
      );
      expect(leaderboardControl.submitScore).toHaveBeenCalledTimes(1);
      expect(leaderboardControl.submitScore).toHaveBeenCalledWith("Ada", 1500);

      // A reload would have taken all of this with it.
      expect(screen.getByText("1500 points")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: /Spotify/i })).toHaveLength(
        10,
      );
      // And there is no second submit to make.
      expect(screen.queryByPlaceholderText("Name...")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Save/i })).toBeNull();
    });

    it("leads on to the leaderboard, and home to the menu", async () => {
      leaderboardControl.setScores([{ name: "Ada", score: 1500 }]);
      await playRun();

      await userEvent.type(screen.getByPlaceholderText("Name..."), "Ada");
      await userEvent.click(screen.getByRole("button", { name: /Save/i }));
      await waitFor(() =>
        expect(screen.getByText("Saved as Ada")).toBeInTheDocument(),
      );

      await userEvent.click(
        screen.getByRole("button", { name: /Leaderboard/i }),
      );
      expect(screen.getByText("Top Scores")).toBeInTheDocument();

      await userEvent.click(homeButton());
      expect(
        screen.getByRole("button", { name: /Competition Mode/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText("1500 points")).not.toBeInTheDocument();
    });
  });
});
