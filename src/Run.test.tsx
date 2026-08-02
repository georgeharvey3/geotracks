import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, fireEvent, readsAs, render, screen, waitFor } from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { spotifyPlayerControl } from "./test/spotifyPlayerFake";
import { leaderboardControl } from "./test/leaderboardFake";
import { communityAlbumsControl } from "./test/communityAlbumsFake";
import { DAILY_RUN_STORAGE_KEY } from "./hooks/useDailyRun";
import {
  answerAt,
  dailySongs,
  countriesOutsideTheRun,
  guessOnMap,
  homeButton,
  mapTarget,
  playRun,
  playTurn,
  reload,
  resetSeams,
  startCompetition,
  startInfinite,
  summaryRow,
  turnsWithSoleAnswers,
} from "./test/appHarness";

// Integration tests mount the real <App> (real reducer, context, routing and
// keyboard shortcuts) and mock ONLY the side-effectful seams: the Spotify
// player, the leaderboard, the Suggestion write and the live half of the
// Library. Everything else is real. No iframe, no network, no MSW.
vi.mock("./hooks/useSpotifyPlayer", () => import("./test/spotifyPlayerFake"));
vi.mock("./hooks/useLeaderboard", () => import("./test/leaderboardFake"));
vi.mock("./hooks/useSuggestions", () => import("./test/suggestionFake"));
vi.mock(
  "./hooks/useCommunityAlbums",
  () => import("./test/communityAlbumsFake"),
);

// The map's pan/zoom wrapper is the one part jsdom cannot run (d3-zoom); the
// rest of the map is real, so map guesses go through the real guess pipeline.
vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("./test/zoomableGroupFake")).default,
}));

// Split out of `App.test.tsx`, which reached the 60s of worker-RPC headroom a
// Vitest file has and began failing CI with every test passing. See
// `src/test/appHarness.tsx`. The halves are drawn where the app is: this one is
// what a Competition Run leaves behind — the summary, the day, and the library
// read the day is seeded from.
beforeEach(resetSeams);

describe("App integration: the end of a Run", () => {
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
      // The day has been played, so the menu offers it back rather than a
      // second Run.
      expect(
        screen.getByRole("button", { name: "Today's Run" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("1500 points")).not.toBeInTheDocument();
    });
  });

  describe("the live half of the Library", () => {
    afterEach(() => communityAlbumsControl.reset());

    it("holds Competition shut until the albums have arrived", () => {
      communityAlbumsControl.loading();
      render(<App />);

      // The day's ten are drawn *by index* from a pool that is part bundled and
      // part live. Seeding before the live half lands gives a different ten,
      // played onto the same leaderboard, with nothing looking wrong.
      const competition = screen.getByRole("button", {
        name: /Loading today's songs/,
      });
      expect(competition).toBeDisabled();
    });

    it("keeps Competition shut when the read fails, rather than seeding short", () => {
      communityAlbumsControl.failed();
      render(<App />);

      // The one place in the app that fails *closed*: the Daily Run's stored
      // record fails open, because a serialization bug of ours must not look
      // like a punishment, whereas a Run on the wrong pool is worse than no Run
      // at all, being counted.
      expect(
        screen.getByRole("button", { name: /songs are unavailable/ }),
      ).toBeDisabled();
    });

    it("leaves Infinite and Explore open throughout", async () => {
      communityAlbumsControl.failed();
      render(<App />);

      // Neither is compared between players, so neither has anything to
      // corrupt; the bundled half is all they ever needed.
      expect(
        screen.getByRole("button", { name: /Infinite Mode/ }),
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: /Explore/ })).toBeEnabled();
    });

    it("opens Competition once the albums land", async () => {
      communityAlbumsControl.loading();
      render(<App />);

      act(() => communityAlbumsControl.ready([]));

      expect(
        await screen.findByRole("button", { name: "Competition Mode" }),
      ).toBeEnabled();
    });
  });

  /**
   * The Daily Run (issue #1): one Competition Run per browser profile per day,
   * spent on start and resumed where it stood. Real `localStorage` throughout —
   * jsdom's is synchronous and well-behaved, so there is nothing to fake; the
   * clock is what gets faked, and only where a day has to turn over.
   */
  describe("the Daily Run", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("spends the day the moment the Run is started, not when it is finished", async () => {
      render(<App />);
      await startCompetition();
      await userEvent.click(homeButton());

      expect(
        screen.getByRole("button", { name: "Resume today's Run" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Competition Mode" }),
      ).toBeNull();
      // The other two ways in are untouched: neither has a Run to spend.
      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Explore/i }),
      ).toBeInTheDocument();
    });

    // What makes spending-on-start fair: a mis-tap or a dead battery costs
    // nothing. And the round in flight comes back with it, so two wrong guesses
    // plus a reload cannot buy a fresh 150-point first attempt.
    it("resumes an unfinished Run mid-round, guesses and all", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());
      await playTurn(0);

      const [wrongA, wrongB] = countriesOutsideTheRun(2) as [string, string];
      await guessOnMap(wrongA);
      await guessOnMap(wrongB);

      reload();
      await userEvent.click(
        screen.getByRole("button", { name: "Resume today's Run" }),
      );

      expect(screen.getByText(readsAs("2/10"))).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(mapTarget(wrongA)).toHaveAttribute("data-guess-state", "wrong");
      expect(mapTarget(wrongB)).toHaveAttribute("data-guess-state", "wrong");

      // The answer is now priced as the third attempt: 150 + 60, not 150 + 150.
      await guessOnMap(answerAt(1));
      expect(screen.getByText("210")).toBeInTheDocument();
    });

    it("carries an unfinished Run through Infinite and Explore untouched", async () => {
      render(<App />);
      await startCompetition();
      await userEvent.click(homeButton());

      await startInfinite();
      await userEvent.click(homeButton());
      await userEvent.click(screen.getByRole("button", { name: /Explore/i }));
      await userEvent.click(homeButton());

      reload();
      expect(
        screen.getByRole("button", { name: "Resume today's Run" }),
      ).toBeInTheDocument();
    });

    it("reopens a finished Run as its summary, across a reload", async () => {
      await playRun({ 1: { wrongGuesses: 2 } });

      reload();
      await userEvent.click(
        screen.getByRole("button", { name: "Today's Run" }),
      );

      expect(screen.getByText("1410 points")).toBeInTheDocument();
      expect(screen.getByText("10 of 10 named")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: /Spotify/i })).toHaveLength(
        10,
      );
      // The map is the Run's picture again, drawn from the stored turns.
      expect(mapTarget(answerAt(turnsWithSoleAnswers(1)[0]!))).toHaveAttribute(
        "data-run-outcome",
      );
    });

    // Song metadata looks derived and is stored anyway: it comes from oEmbed at
    // play time, and no player mounts on the summary to fetch it again.
    it("still names the Song it heard in a summary reopened offline", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());
      act(() =>
        spotifyPlayerControl.setMetadata({
          trackTitle: "Turn One Track",
          artistName: "Turn One Artist",
        }),
      );
      for (let turn = 0; turn < 10; turn += 1) {
        await playTurn(turn);
      }

      reload();
      await userEvent.click(
        screen.getByRole("button", { name: "Today's Run" }),
      );

      const row = summaryRow(1, dailySongs[0]!.country);
      expect(row).toHaveTextContent("Turn One Track");
      expect(row).toHaveTextContent("Turn One Artist");
    });

    it("lets a player who closed the tab first still submit, and only once", async () => {
      await playRun();

      reload();
      await userEvent.click(
        screen.getByRole("button", { name: "Today's Run" }),
      );
      await userEvent.type(screen.getByPlaceholderText("Name..."), "Ada");
      await userEvent.click(screen.getByRole("button", { name: /Save/i }));
      await waitFor(() =>
        expect(screen.getByText("Saved as Ada")).toBeInTheDocument(),
      );

      // Reopening the summary must not offer the append-only leaderboard the
      // same score a second time.
      reload();
      await userEvent.click(
        screen.getByRole("button", { name: "Today's Run" }),
      );
      expect(screen.queryByPlaceholderText("Name...")).toBeNull();
      expect(screen.getByText("Saved to the leaderboard")).toBeInTheDocument();
      expect(leaderboardControl.submitScore).toHaveBeenCalledTimes(1);
    });

    it("hands the day back at the next local midnight", async () => {
      render(<App />);
      await startCompetition();
      await userEvent.click(homeButton());
      expect(
        screen.getByRole("button", { name: "Resume today's Run" }),
      ).toBeInTheDocument();

      // Only Date is faked: the rest of the suite's timers stay real. The day
      // the record was stamped with is the day the song seed reads, so this
      // moves both.
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(tomorrow);

      reload();
      expect(
        screen.getByRole("button", { name: "Competition Mode" }),
      ).toBeInTheDocument();

      // And it is a Run from the top, not yesterday's carried over.
      await startCompetition();
      expect(screen.getByText(readsAs("1/10"))).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    // Failing open: a serialization bug of ours must not be indistinguishable
    // from a punishment.
    it("gives the player their Run when the stored day will not parse", async () => {
      render(<App />);
      await startCompetition();
      await userEvent.click(homeButton());

      localStorage.setItem(DAILY_RUN_STORAGE_KEY, "{ half a record");
      reload();

      expect(
        screen.getByRole("button", { name: "Competition Mode" }),
      ).toBeInTheDocument();
    });
  });
});
