import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  cleanup,
  readsAs,
  render,
  screen,
  waitFor,
  within,
} from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { adminControl } from "./test/adminFake";
import type { StoredSuggestion } from "./hooks/useAdmin";

// The same four seams the rest of the suite mocks, plus `useAdmin` — which
// stands in for two things a test cannot have: a Google popup, and a rule on
// Firebase's side deciding whether this account may read.
vi.mock("./hooks/useSpotifyPlayer", () => import("./test/spotifyPlayerFake"));
vi.mock("./hooks/useLeaderboard", () => import("./test/leaderboardFake"));
vi.mock("./hooks/useSuggestions", () => import("./test/suggestionFake"));
vi.mock("./hooks/useAdmin", () => import("./test/adminFake"));

vi.mock("react-simple-maps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-simple-maps")>()),
  ZoomableGroup: (await import("./test/zoomableGroupFake")).default,
}));

const suggestion = (
  over: Partial<StoredSuggestion> = {},
): StoredSuggestion => ({
  key: "-Oz0Maolcc3TKkMg4QHd",
  albumId: "4EspSWFweWoS9nFJnxUekz",
  countryCode: "TW",
  uid: "someone",
  createdAt: Date.parse("2026-08-02T09:00:00Z"),
  ...over,
});

/** Open the app on the review screen, the only way in there is. */
const openAdmin = () => {
  window.location.hash = "#admin";
  return render(<App />);
};

const clipboard = { writeText: vi.fn(async () => {}) };

beforeEach(() => {
  adminControl.reset();
  clipboard.writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
  // The rows resolve album title and artwork through Spotify's public oEmbed
  // endpoint. Stubbed rather than reached for; a row must survive it failing.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        title: "Aboriginal Folk Songs of Taiwan",
        thumbnail_url: "https://i.scdn.co/image/abc",
      }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("Suggestion review", () => {
  it("is not reachable without the hash", () => {
    render(<App />);

    expect(screen.getByText("Competition Mode")).toBeInTheDocument();
    expect(screen.queryByText("Suggestions")).not.toBeInTheDocument();
  });

  it("opens on the hash, asking to sign in", () => {
    openAdmin();

    expect(
      screen.getByRole("heading", { name: "Suggestions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign in with Google/ }),
    ).toBeInTheDocument();
  });

  it("prints the uid when the account is not the one the rules allow", async () => {
    openAdmin();
    adminControl.denied("uid-nobody-granted");

    expect(
      await screen.findByText(/can't read the Suggestions/),
    ).toBeInTheDocument();
    // This is how the rule gets written: there is no way to know your own uid
    // before signing in once, so the first sign-in is always denied.
    expect(screen.getByText("uid-nobody-granted")).toBeInTheDocument();
  });

  it("shows a waiting Suggestion, with what it is and where it came from", async () => {
    openAdmin();
    adminControl.allowed([suggestion({ note: "Recorded in Taitung, 1978." })]);

    expect(
      await screen.findByText("Aboriginal Folk Songs of Taiwan"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(readsAs("Taiwan · 2026-08-02")),
    ).toBeInTheDocument();
    expect(screen.getByText("Recorded in Taitung, 1978.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open in Spotify/ }),
    ).toHaveAttribute(
      "href",
      "https://open.spotify.com/album/4EspSWFweWoS9nFJnxUekz",
    );
  });

  it("survives an album that will not resolve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    openAdmin();
    adminControl.allowed([suggestion()]);

    // The country and the link are enough to judge it by, so the row stays.
    expect(await screen.findByText(/Taiwan/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open in Spotify/ }),
    ).toBeInTheDocument();
  });

  it("copies the accept command rather than accepting", async () => {
    openAdmin();
    adminControl.allowed([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /Copy accept command/ }),
    );

    // Accepting writes a file into the repo and ends in a commit, which no page
    // on the internet gets to do (ADR-0005). The terminal stays the only thing
    // that can change the Library.
    expect(clipboard.writeText).toHaveBeenCalledWith(
      "node scripts/add-community-album.ts 4EspSWFweWoS9nFJnxUekz TW",
    );
    expect(await screen.findByText("Command copied")).toBeInTheDocument();
  });

  it("takes two clicks to reject, and the first one deletes nothing", async () => {
    openAdmin();
    adminControl.allowed([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Reject$/ }),
    );
    expect(adminControl.rejected()).toEqual([]);

    await userEvent.click(
      screen.getByRole("button", { name: /Reject for good/ }),
    );
    expect(adminControl.rejected()).toEqual(["-Oz0Maolcc3TKkMg4QHd"]);
    await waitFor(() =>
      expect(screen.getByText("Nothing waiting.")).toBeInTheDocument(),
    );
  });

  it("lets an armed rejection be called off", async () => {
    openAdmin();
    adminControl.allowed([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Reject$/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(adminControl.rejected()).toEqual([]);
    expect(
      screen.getByRole("button", { name: /^Reject$/ }),
    ).toBeInTheDocument();
  });

  it("clears the hash on the way back to the menu, so a reload lands home", async () => {
    openAdmin();
    adminControl.allowed([]);

    await userEvent.click(
      await screen.findByRole("button", { name: "Back to menu" }),
    );

    expect(window.location.hash).toBe("");
    expect(screen.getByText("Competition Mode")).toBeInTheDocument();
  });

  it("stands on the night backdrop, as the other content pages do", async () => {
    const { container } = openAdmin();

    await waitFor(() =>
      expect(
        within(container).getByText(/Accepting one is a commit/),
      ).toBeInTheDocument(),
    );
    expect(container.querySelector('[data-surface="night"]')).not.toBeNull();
  });
});
