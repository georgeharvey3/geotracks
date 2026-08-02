import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { spotifyPlayerControl } from "./test/spotifyPlayerFake";
import { setHoverCapability } from "./test/hoverCapability";

// Same shape as the app integration suite: the real <App> (real reducers, real
// context, real routing, real map) with only the side-effectful seams faked.
vi.mock("./hooks/useSpotifyPlayer", () => import("./test/spotifyPlayerFake"));
vi.mock("./hooks/useLeaderboard", () => import("./test/leaderboardFake"));
vi.mock("./hooks/useSuggestions", () => import("./test/suggestionFake"));
vi.mock(
  "./hooks/useCommunityAlbums",
  () => import("./test/communityAlbumsFake"),
);

vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("./test/zoomableGroupFake")).default,
}));

// Countries chosen only for what the catalogue holds: France and Jamaica have
// music (Jamaica as a straggler point-marker), Belgium has none.
const PLAYABLE = "France";
const PLAYABLE_STRAGGLER = "Jamaica";
const SILENT = "Belgium";

// The map's target for a country — its polygon, or its point-marker when the
// country is too small to draw one.
const mapTarget = (country: string) => screen.getByLabelText(country);

/**
 * Which Song is playing, read off the card's Spotify link. The address comes
 * from the real reducer, never from the fake, so it is the one handle that
 * tells two Songs apart without a test asserting what it just fed in.
 */
const playingLink = () =>
  screen.getByRole("link", { name: /Open in Spotify/i }).getAttribute("href");

const playButton = () => screen.getByTestId("PlayArrowIcon").closest("button")!;
const pauseButton = () => screen.getByTestId("PauseIcon").closest("button")!;
const homeButton = () => screen.getByTestId("HomeIcon").closest("button")!;
const skipButton = () => screen.getByRole("button", { name: /Skip/i });

async function enterExplore() {
  await userEvent.click(screen.getByRole("button", { name: /^Explore$/i }));
  // The world's ~250 country shapes are drawn a tick after the screen mounts.
  await screen.findByLabelText(PLAYABLE);
}

/** Choose a country and let its Song load, as the real player would. */
async function choose(country: string) {
  await userEvent.click(mapTarget(country));
  act(() => spotifyPlayerControl.emitReady());
}

beforeEach(() => {
  spotifyPlayerControl.reset();
});

describe("Explore", () => {
  describe("getting in and out", () => {
    it("opens from the menu and offers the map with nothing chosen", async () => {
      render(<App />);
      await enterExplore();

      expect(
        screen.getByText("Choose a country to hear its music"),
      ).toBeInTheDocument();
      expect(mapTarget(PLAYABLE)).toBeInTheDocument();
      // Nothing to play and nothing to skip until a country is chosen.
      expect(screen.queryByRole("button", { name: /Skip/i })).toBeNull();
    });

    it("returns to the menu from the Home control", async () => {
      render(<App />);
      await enterExplore();
      await userEvent.click(homeButton());

      expect(
        screen.getByRole("button", { name: /Infinite Mode/i }),
      ).toBeInTheDocument();
    });

    it("takes the player with it on the way out", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      expect(document.getElementById("embed-iframe")).toBeInTheDocument();

      await userEvent.click(homeButton());

      // Nothing left to make a sound with.
      expect(document.getElementById("embed-iframe")).toBeNull();
    });

    it("comes back with nothing chosen and nothing playing", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);

      await userEvent.click(homeButton());
      await enterExplore();

      expect(
        screen.getByText("Choose a country to hear its music"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: PLAYABLE })).toBeNull();
      expect(screen.queryByRole("button", { name: /Skip/i })).toBeNull();
    });

    it("picks the country up where it was left when it is chosen again", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      await userEvent.click(skipButton());
      const wasPlaying = playingLink();

      await userEvent.click(homeButton());
      await enterExplore();
      await choose(PLAYABLE);

      expect(playingLink()).toBe(wasPlaying);
    });
  });

  describe("choosing a country on the map", () => {
    it("plays a Song from the country and names it", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);

      expect(screen.getByRole("heading", { name: PLAYABLE })).toBeVisible();
      expect(playingLink()).toBeTruthy();
      // Everything about the Song is on show from the first note.
      expect(screen.getByText(/Open in Spotify/i)).toBeInTheDocument();
    });

    it("starts playing by itself, without a second action", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);

      expect(pauseButton()).toBeInTheDocument();
    });

    it("marks the country being listened to on the map", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);

      expect(mapTarget(PLAYABLE)).toHaveAttribute(
        "data-explore-state",
        "playing",
      );
    });

    it("reaches a country too small to draw, through its point-marker", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE_STRAGGLER);

      expect(
        screen.getByRole("heading", { name: PLAYABLE_STRAGGLER }),
      ).toBeVisible();
    });

    it("switches countries when another is chosen", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      await choose(PLAYABLE_STRAGGLER);

      expect(
        screen.getByRole("heading", { name: PLAYABLE_STRAGGLER }),
      ).toBeVisible();
      expect(mapTarget(PLAYABLE_STRAGGLER)).toHaveAttribute(
        "data-explore-state",
        "playing",
      );
      expect(mapTarget(PLAYABLE)).not.toHaveAttribute(
        "data-explore-state",
        "playing",
      );
    });

    it("does nothing when the country already playing is chosen again", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const wasPlaying = playingLink();

      await userEvent.click(mapTarget(PLAYABLE));

      expect(playingLink()).toBe(wasPlaying);
    });
  });

  describe("a country with no music", () => {
    it("is drawn apart from the countries that have some", async () => {
      render(<App />);
      await enterExplore();

      expect(mapTarget(SILENT)).toHaveAttribute("data-explore-state", "silent");
      expect(mapTarget(PLAYABLE)).toHaveAttribute(
        "data-explore-state",
        "playable",
      );
      expect(mapTarget(SILENT).getAttribute("fill")).not.toBe(
        mapTarget(PLAYABLE).getAttribute("fill"),
      );
    });

    it("invites the pointer, now that there is something to say about it", async () => {
      render(<App />);
      await enterExplore();

      expect(mapTarget(SILENT)).toHaveStyle({ cursor: "pointer" });
      expect(mapTarget(PLAYABLE)).toHaveStyle({ cursor: "pointer" });
    });

    it("still gives up its name on hover", async () => {
      render(<App />);
      await enterExplore();

      fireEvent.mouseEnter(mapTarget(SILENT));

      expect(screen.getByText(SILENT)).toBeInTheDocument();
    });

    it("is picked as the country being asked about, and says so", async () => {
      render(<App />);
      await enterExplore();

      await userEvent.click(mapTarget(SILENT));

      expect(
        screen.getByText(`No music from ${SILENT} yet`),
      ).toBeInTheDocument();
      expect(mapTarget(SILENT)).toHaveAttribute("data-explore-state", "asked");
    });

    /**
     * The whole reason the map click does not navigate. Explore commits on a
     * single tap, and leaving the screen unmounts the player — so if a silent
     * country went straight to the form, one stray tap would cost the Song as
     * well as the screen.
     */
    it("does not stop the music when it is picked mid-Song", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const playing = playingLink();

      await userEvent.click(mapTarget(SILENT));

      expect(playingLink()).toBe(playing);
      expect(pauseButton()).toBeInTheDocument();
      // The country being listened to is untouched by the question.
      expect(mapTarget(PLAYABLE)).toHaveAttribute(
        "data-explore-state",
        "playing",
      );
    });

    it("hands the country to the Suggestion form on a second, deliberate action", async () => {
      render(<App />);
      await enterExplore();
      await userEvent.click(mapTarget(SILENT));

      await userEvent.click(
        screen.getByRole("button", { name: /Suggest an album/i }),
      );

      expect(screen.getByLabelText("Country the music comes from")).toHaveValue(
        SILENT,
      );
    });

    it("lets the offer go when a country with music is chosen instead", async () => {
      render(<App />);
      await enterExplore();
      await userEvent.click(mapTarget(SILENT));

      await choose(PLAYABLE);

      expect(screen.queryByText(`No music from ${SILENT} yet`)).toBeNull();
    });
  });

  describe("listening", () => {
    it("skips to a Song the player has not heard from that country", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const first = playingLink();

      await userEvent.click(skipButton());

      expect(playingLink()).not.toBe(first);
    });

    it("moves on by itself when a Song ends", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const first = playingLink();

      act(() => spotifyPlayerControl.emitFinished());

      expect(playingLink()).not.toBe(first);
    });

    it("pauses without giving up the country, and stops the run", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const playing = playingLink();

      await userEvent.click(pauseButton());

      // Paused means paused: still this country, still this Song.
      expect(playButton()).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: PLAYABLE })).toBeVisible();
      expect(playingLink()).toBe(playing);
    });

    it("resumes what was paused", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      await userEvent.click(pauseButton());

      await userEvent.click(playButton());

      expect(pauseButton()).toBeInTheDocument();
    });
  });

  describe("a Song that will not load", () => {
    it("offers a retry and a way past it, side by side", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);

      act(() => spotifyPlayerControl.emitLoadFailure());

      expect(screen.getByText("Song failed to load")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Retry/i }),
      ).toBeInTheDocument();
      expect(skipButton()).toBeInTheDocument();
    });

    it("moves past it in one action", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const rotted = playingLink();
      act(() => spotifyPlayerControl.emitLoadFailure());

      await userEvent.click(skipButton());

      expect(playingLink()).not.toBe(rotted);
    });
  });

  describe("choosing a country by name", () => {
    it("suggests only countries that have music", async () => {
      render(<App />);
      await enterExplore();
      const input = screen.getByPlaceholderText("Country");

      await userEvent.type(input, SILENT.slice(0, 4));
      expect(screen.queryByRole("list")).toBeNull();

      await userEvent.clear(input);
      await userEvent.type(input, PLAYABLE.slice(0, 4));
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    it("plays a country typed by name", async () => {
      render(<App />);
      await enterExplore();

      const input = screen.getByPlaceholderText("Country");
      await userEvent.type(input, PLAYABLE);
      await userEvent.click(
        screen
          .getAllByRole("button")
          .find((b) => b.getAttribute("type") === "submit")!,
      );

      expect(screen.getByRole("heading", { name: PLAYABLE })).toBeVisible();
    });

    it("takes typing anywhere on the screen as typing into the box", async () => {
      render(<App />);
      await enterExplore();
      const input = screen.getByPlaceholderText("Country");
      expect(input).not.toHaveFocus();

      fireEvent.keyPress(document, { key: "a", charCode: 97 });

      expect(input).toHaveFocus();
    });

    it("keeps the game's shortcuts: Space plays, Enter skips", async () => {
      render(<App />);
      await enterExplore();
      await choose(PLAYABLE);
      const first = playingLink();

      fireEvent.keyPress(document, { key: " ", charCode: 32 });
      expect(playButton()).toBeInTheDocument();

      fireEvent.keyPress(document, { key: "Enter", charCode: 13 });
      expect(playingLink()).not.toBe(first);
    });
  });

  describe("on a device without a hovering pointer", () => {
    beforeEach(() => setHoverCapability(false));

    it("chooses a country on a single tap", async () => {
      render(<App />);
      await enterExplore();

      await choose(PLAYABLE);

      expect(screen.getByRole("heading", { name: PLAYABLE })).toBeVisible();
    });
  });
});
