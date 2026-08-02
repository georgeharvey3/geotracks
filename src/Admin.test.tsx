import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  readsAs,
  render,
  screen,
  waitFor,
  within,
} from "./test-utils";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { adminControl } from "./test/adminFake";
import { spotifyAuthControl } from "./test/spotifyAuthFake";
import type { StoredSuggestion } from "./hooks/useAdmin";

// The same four seams the rest of the suite mocks, plus the review screen's two:
// `useAdmin`, which stands in for a Google popup, a rule on Firebase's side
// deciding whether this account may read, and the accept write; and
// `useSpotifyAuth`, which stands in for a popup window negotiating OAuth with a
// third party.
vi.mock("./hooks/useSpotifyPlayer", () => import("./test/spotifyPlayerFake"));
vi.mock("./hooks/useLeaderboard", () => import("./test/leaderboardFake"));
vi.mock("./hooks/useSuggestions", () => import("./test/suggestionFake"));
vi.mock(
  "./hooks/useCommunityAlbums",
  () => import("./test/communityAlbumsFake"),
);
vi.mock("./hooks/useAdmin", () => import("./test/adminFake"));
vi.mock("./hooks/useSpotifyAuth", () => import("./test/spotifyAuthFake"));

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

/** Open the queue with these Suggestions, Spotify already connected. */
const openWithSpotify = (suggestions: StoredSuggestion[]) => {
  const rendered = openAdmin();
  adminControl.allowed(suggestions);
  spotifyAuthControl.connected();
  return rendered;
};

beforeEach(() => {
  adminControl.reset();
  spotifyAuthControl.reset();
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

  it("opens when the hash is added to a page that is already loaded", async () => {
    // The likeliest way anyone gets here: type it into the address bar of an
    // open tab. That navigates nowhere and remounts nothing, so a hash read
    // only at mount does nothing at all.
    render(<App />);
    expect(screen.getByText("Competition Mode")).toBeInTheDocument();

    window.location.hash = "#admin";
    fireEvent(window, new HashChangeEvent("hashchange"));

    expect(
      await screen.findByRole("heading", { name: "Suggestions" }),
    ).toBeInTheDocument();
  });

  it("keeps the hash while it is open, so a reload comes back here", async () => {
    openAdmin();

    expect(
      await screen.findByRole("heading", { name: "Suggestions" }),
    ).toBeInTheDocument();
    // Both hash effects run in the same commit on mount, and the one that
    // clears would otherwise see a `screen` still reading "menu".
    expect(window.location.hash).toBe("#admin");
  });

  it("names the authorized-domains list when Firebase refuses the origin", async () => {
    // The failure this screen actually meets, and the one "that didn't sign you
    // in" hides completely: the origin is not on Firebase's list, which is a
    // console setting rather than anything the reviewer did wrong.
    openAdmin();
    adminControl.signInFails("auth/unauthorized-domain");

    await userEvent.click(
      screen.getByRole("button", { name: /Sign in with Google/ }),
    );

    expect(await screen.findByText(/Authorized domains/)).toBeInTheDocument();
    expect(screen.getByText("auth/unauthorized-domain")).toBeInTheDocument();
  });

  it("prints the code for a refusal it has no advice for", async () => {
    openAdmin();
    adminControl.signInFails("auth/popup-blocked");

    await userEvent.click(
      screen.getByRole("button", { name: /Sign in with Google/ }),
    );

    expect(await screen.findByText(/didn't sign you in/)).toBeInTheDocument();
    expect(screen.getByText("auth/popup-blocked")).toBeInTheDocument();
  });

  it("says nothing when the reviewer closes the popup themselves", async () => {
    openAdmin();
    adminControl.signInFails("auth/popup-closed-by-user", true);

    await userEvent.click(
      screen.getByRole("button", { name: /Sign in with Google/ }),
    );

    // Closing a popup is an answer, not a fault, and reporting it as one would
    // teach the reviewer to ignore the place the real faults are named.
    expect(screen.queryByText(/didn't sign you in/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("auth/popup-closed-by-user"),
    ).not.toBeInTheDocument();
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

  it("still hands over the terminal command, for what only the script can do", async () => {
    openAdmin();
    adminControl.allowed([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /Copy command/ }),
    );

    // The screen can accept by itself now (ADR-0008), but `--live-from` and
    // adding an album nobody suggested still live in the script.
    expect(clipboard.writeText).toHaveBeenCalledWith(
      "node scripts/add-community-album.ts 4EspSWFweWoS9nFJnxUekz TW",
    );
    expect(await screen.findByText("Command copied")).toBeInTheDocument();
  });

  it("cannot accept until Spotify is connected, and says why", async () => {
    openAdmin();
    adminControl.allowed([suggestion()]);

    // The track list is the thing oEmbed never had and the catalogue API wants a
    // token for. A disabled button with no explanation is the bad version of
    // this, so the strip above the queue is the explanation.
    expect(
      await screen.findByRole("button", { name: /^Accept$/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/reads the album's track list from Spotify/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Connect Spotify" }),
    );

    expect(screen.getByRole("button", { name: /^Accept$/ })).toBeEnabled();
  });

  it("takes two clicks to accept, and the first one writes nothing", async () => {
    openWithSpotify([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Accept$/ }),
    );
    expect(adminControl.accepted()).toEqual([]);

    await userEvent.click(
      screen.getByRole("button", { name: /Add to the Library/ }),
    );

    expect(adminControl.accepted()).toEqual([
      { key: "-Oz0Maolcc3TKkMg4QHd", liveFrom: expect.any(String) },
    ]);
  });

  it("accepts on the date it said it would", async () => {
    openWithSpotify([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Accept$/ }),
    );

    // Armed, the row states what accepting does — live at once, and in
    // Competition from a date. That date is the one that gets written: a
    // `liveFrom` authored a day ahead is the whole of what stops a Daily Run
    // changing under somebody part-way through it.
    const shown = screen.getByText(/Goes live in Explore and Infinite/);
    const date = shown.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    expect(date).toBeDefined();

    await userEvent.click(
      screen.getByRole("button", { name: /Add to the Library/ }),
    );

    expect(adminControl.accepted()).toEqual([
      { key: "-Oz0Maolcc3TKkMg4QHd", liveFrom: date },
    ]);
  });

  it("takes an accepted Suggestion out of the queue", async () => {
    openWithSpotify([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Accept$/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Add to the Library/ }),
    );

    // There is no "accepted" state to show: the same write that stores the album
    // deletes the Suggestion, so the queue empties itself.
    await waitFor(() =>
      expect(screen.getByText("Nothing waiting.")).toBeInTheDocument(),
    );
  });

  it("says what is wrong when accepting is refused, and keeps the row", async () => {
    openWithSpotify([suggestion()]);
    adminControl.acceptFails({
      ok: false,
      reason: "duplicate",
      albumName: "Songs of the Amis",
    });

    await userEvent.click(
      await screen.findByRole("button", { name: /^Accept$/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Add to the Library/ }),
    );

    expect(
      await screen.findByText(/Already in the Library, as "Songs of the Amis"/),
    ).toBeInTheDocument();
    // Still there to decide about: a refused accept has decided nothing.
    expect(
      screen.getByRole("button", { name: /^Accept$/ }),
    ).toBeInTheDocument();
  });

  it("lets an armed acceptance be called off", async () => {
    openWithSpotify([suggestion()]);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Accept$/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(adminControl.accepted()).toEqual([]);
    expect(
      screen.getByRole("button", { name: /^Accept$/ }),
    ).toBeInTheDocument();
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
        within(container).getByText(/Accepting one adds it to the Library/),
      ).toBeInTheDocument(),
    );
    expect(container.querySelector('[data-surface="night"]')).not.toBeNull();
  });
});
