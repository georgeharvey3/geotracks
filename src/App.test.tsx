import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, readsAs, render, screen, within } from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { spotifyPlayerControl } from "./test/spotifyPlayerFake";
import { leaderboardControl } from "./test/leaderboardFake";
import { suggestionControl } from "./test/suggestionFake";
import {
  answerAt,
  currentAnswer,
  guessOnMap,
  hasDirectionIcon,
  homeButton,
  mapTarget,
  playButton,
  resetSeams,
  startCompetition,
  startInfinite,
  submitGuess,
  wrongCountriesFor,
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

// The Run summary, the Daily Run and the Library read live in `Run.test.tsx`:
// one file may not run for 60 seconds (see `src/test/appHarness.tsx`).
beforeEach(resetSeams);

describe("App integration", () => {
  describe("menu and navigation", () => {
    it("shows the title and mode buttons on the menu", () => {
      render(<App />);
      expect(
        screen.getByRole("heading", { name: "GeoTracks" }),
      ).toBeInTheDocument();
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

    // The backdrop is what says a screen is *about* the game without being made
    // of it. Both content pages get it; the map surfaces are the map already.
    it("stands both content pages on the map, and neither map surface", async () => {
      render(<App />);
      expect(screen.getByTestId("page-backdrop")).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /Scoreboard/i }),
      );
      expect(screen.getByTestId("page-backdrop")).toBeInTheDocument();

      await userEvent.click(homeButton());
      await startInfinite();
      expect(screen.queryByTestId("page-backdrop")).not.toBeInTheDocument();
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

      const wrong = wrongCountriesFor(currentAnswer(), 1)[0]!;
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

      const wrong = wrongCountriesFor(currentAnswer(), 1)[0]!;
      await submitGuess(wrong);

      // Once in the guess list, once on the map.
      expect(screen.getAllByText(/\d+\s*km/)).toHaveLength(2);
      expect(hasDirectionIcon()).toBe(true);
    });

    it("reveals the answer after five wrong guesses", async () => {
      render(<App />);
      await startInfinite();
      act(() => spotifyPlayerControl.emitReady());

      const answer = currentAnswer();
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

      for (const wrong of wrongCountriesFor(currentAnswer(), 5)) {
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

      const answer = currentAnswer();
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

      const [typed, clicked] = wrongCountriesFor(currentAnswer(), 2) as [
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

      const answer = currentAnswer();
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
    it("shows the standings and what GeoHints cost", async () => {
      render(<App />);
      await startCompetition();

      // The standings live on their own plaque over the map: score, and the
      // turn being played out of ten.
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText(readsAs("1/10"))).toBeInTheDocument();
      expect(screen.getByText("half points")).toBeInTheDocument();
    });

    it("scores across turns and reaches the Run summary", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());

      // First-guess-correct on every turn = 150 * 10 = 1500.
      for (let turn = 0; turn < 10; turn += 1) {
        await submitGuess(answerAt(turn));
        expect(screen.getByText(`${(turn + 1) * 150}`)).toBeInTheDocument();
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

      expect(screen.getByText("150")).toBeInTheDocument();
    });

    it("halves the score for the round when GeoHints is enabled", async () => {
      render(<App />);
      await startCompetition();
      act(() => spotifyPlayerControl.emitReady());

      await userEvent.click(screen.getByLabelText("GeoHints"));
      await submitGuess(answerAt(0));

      // 150 base, halved to 75 because hints were enabled this round.
      expect(screen.getByText("75")).toBeInTheDocument();
    });
  });

  describe("suggesting an album", () => {
    const ALBUM_URL =
      "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3?si=abcdef";
    const ALBUM_ID = "1DFixLWuPkv3KT3TnV35m3";

    const linkBox = () => screen.getByLabelText("Album on Spotify");
    const countryBox = () =>
      screen.getByLabelText("Country the music comes from");
    const sendButton = () =>
      screen.getByRole("button", { name: /Send suggestion|Try again/i });

    async function openSuggest() {
      render(<App />);
      await userEvent.click(
        screen.getByRole("button", { name: /Suggest an album/i }),
      );
    }

    /**
     * Choose a country from the picker's own list, as `CountryInput`'s tests
     * do — the suggestion's label is split across a `<strong>`, so it is found
     * by its text rather than by an accessible name.
     */
    async function chooseCountry(country: string) {
      await userEvent.type(countryBox(), country.slice(0, 3));
      const list = await screen.findByRole("list");
      const item = within(list)
        .getAllByRole("button")
        .find((option) => option.textContent === country)!;
      await userEvent.click(item);
    }

    /** Fill the two required fields, choosing the country from the picker. */
    async function fillForm(country = "Chad") {
      await userEvent.type(linkBox(), ALBUM_URL);
      await chooseCountry(country);
    }

    it("carries an album, a country and a note through to the write", async () => {
      await openSuggest();
      await fillForm();
      await userEvent.type(screen.getByLabelText("Why (optional)"), "Great");
      await userEvent.click(sendButton());

      // The id, not the URL: storing the URL would mean keeping a stranger's
      // `?si=` share-tracking token indefinitely for no benefit.
      expect(suggestionControl.submitted()).toEqual([
        { albumId: ALBUM_ID, countryCode: "TD", note: "Great" },
      ]);
    });

    it("leaves the note out of the record when it is blank", async () => {
      await openSuggest();
      await fillForm();
      await userEvent.click(sendButton());

      expect(suggestionControl.submitted()).toEqual([
        { albumId: ALBUM_ID, countryCode: "TD" },
      ]);
    });

    it("replaces the form with a confirmation, and offers another", async () => {
      await openSuggest();
      await fillForm();
      await userEvent.click(sendButton());

      expect(
        await screen.findByText("Suggestion received"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Album on Spotify")).toBeNull();

      await userEvent.click(
        screen.getByRole("button", { name: /Suggest another/i }),
      );
      expect(linkBox()).toHaveValue("");
    });

    it("holds the send button until both required fields are good", async () => {
      await openSuggest();
      expect(sendButton()).toBeDisabled();

      await userEvent.type(linkBox(), ALBUM_URL);
      expect(sendButton()).toBeDisabled();

      await chooseCountry("Chad");
      expect(sendButton()).toBeEnabled();
    });

    it("names a track link for what it is", async () => {
      await openSuggest();
      await userEvent.type(
        linkBox(),
        "https://open.spotify.com/track/1DFixLWuPkv3KT3TnV35m3",
      );

      expect(
        screen.getByText(/track link — paste the album/i),
      ).toBeInTheDocument();
      expect(sendButton()).toBeDisabled();
    });

    it("keeps what was typed when the write fails, and can be retried", async () => {
      suggestionControl.failWrites();
      await openSuggest();
      await fillForm();
      await userEvent.click(sendButton());

      expect(await screen.findByText(/didn't send/i)).toBeInTheDocument();
      // Nothing is lost: the values are still there to send again.
      expect(linkBox()).toHaveValue(ALBUM_URL);
      expect(countryBox()).toHaveValue("Chad");

      suggestionControl.reset();
      await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
      expect(
        await screen.findByText("Suggestion received"),
      ).toBeInTheDocument();
    });

    it("returns to the menu from the Home control", async () => {
      await openSuggest();
      await userEvent.click(homeButton());

      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
    });
  });
});
