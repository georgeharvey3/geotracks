import { act, cleanup, render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";

import App from "../App";
import getDailySongs from "../helpers/getDailySongs";
import { bundledAlbums, competitionAlbums } from "../music/library";
import { dayString } from "../helpers/dailyRun";
import countriesJSON from "../countries.json";
import { spotifyPlayerControl } from "./spotifyPlayerFake";
import { leaderboardControl } from "./leaderboardFake";
import { suggestionControl } from "./suggestionFake";

/**
 * What the two `<App>` integration suites share: the day's answers, the
 * countries it is safe to guess wrongly, and the moves a test makes.
 *
 * **It exists because a test file may not run for 60 seconds.** Vitest's worker
 * RPC is birpc's default 60s timeout, and a file that busy for that long stops
 * answering `onTaskUpdate` in time; the run then fails with every test passing,
 * which is the least debuggable shape a CI failure has. `App.test.tsx` reached
 * 61s on a CI runner and started failing exactly there. Splitting it in two is
 * the fix, and this is what the halves would otherwise have duplicated.
 *
 * The seams themselves stay mocked in each file: `vi.mock` is hoisted per file
 * and cannot be inherited from here.
 */

// Competition plays the Daily Songs; compute the same deterministic set here so
// tests know the correct answer per turn. Infinite does *not* — it draws at
// random (issue #49) — so its answer is read from the Song the player was
// handed, never from this list.
// The suite runs with no live albums (the fake is ready-and-empty by default),
// so the Competition pool is the bundled half exactly.
export const dailySongs = getDailySongs(
  competitionAlbums(bundledAlbums, dayString(new Date())),
);
export const answerAt = (round: number) => dailySongs[round]!.country;

// Every track link in the library, against the country it comes from: no link
// appears under two countries, so this reads back an answer unambiguously.
const countryByLink = new Map(
  bundledAlbums.flatMap((album) =>
    album.tracks.map((track) => [track, album.country] as const),
  ),
);

/** The answer to the round now being played, whichever Song it drew. */
export function currentAnswer(): string {
  const link = spotifyPlayerControl.loadedLink();
  const country = link ? countryByLink.get(link) : undefined;
  if (!country) {
    throw new Error(`No Song is loaded to read an answer from (link: ${link})`);
  }
  return country;
}

const allCountryNames = countriesJSON.map((c) => c.name);
export function wrongCountriesFor(answer: string, count: number): string[] {
  return allCountryNames
    .filter((name) => name.toLowerCase() !== answer.toLowerCase())
    .slice(0, count);
}

// The ten turns a Competition Run asks for today. The daily seed moves with the
// date, so nothing about today's ten may be hard-coded — including whether they
// are ten different countries.
export const runTurns = Array.from({ length: 10 }, (_, turn) => answerAt(turn));

/** Countries no turn of this Run asks for: safe to guess wrongly, or to hover. */
export function countriesOutsideTheRun(count: number): string[] {
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
export function turnsWithSoleAnswers(count: number): number[] {
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
export const hasDirectionIcon = () =>
  DIRECTION_TESTIDS.some((id) => screen.queryByTestId(id) !== null);

export async function startInfinite() {
  await userEvent.click(screen.getByRole("button", { name: /Infinite Mode/i }));
}

export async function startCompetition() {
  await userEvent.click(
    screen.getByRole("button", { name: /Competition Mode/i }),
  );
}

/**
 * Close the tab and come back to it. Real `localStorage` survives this, which
 * is the whole point: the Daily Run is the one thing in the app that outlives
 * the page.
 */
export function reload() {
  cleanup();
  render(<App />);
}

export async function submitGuess(country: string) {
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
export const mapTarget = (country: string) => screen.getByLabelText(country);

export async function guessOnMap(country: string) {
  await userEvent.click(mapTarget(country));
}

export const playButton = () =>
  screen.getByTestId("PlayArrowIcon").closest("button")!;
export const homeButton = () =>
  screen.getByTestId("HomeIcon").closest("button")!;

export interface TurnPlan {
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
export async function playTurn(turn: number, plan: TurnPlan = {}) {
  if (plan.hints) await userEvent.click(screen.getByLabelText("GeoHints"));

  const wrongCount = plan.miss ? 5 : (plan.wrongGuesses ?? 0);
  for (const wrong of countriesOutsideTheRun(wrongCount)) {
    await guessOnMap(wrong);
  }
  if (!plan.miss) await guessOnMap(answerAt(turn));

  await userEvent.click(screen.getByRole("button", { name: /Next Song/i }));
}

/** Play a whole Competition Run, landing on the Run summary. */
export async function playRun(plans: Record<number, TurnPlan> = {}) {
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
export const summaryRow = (turnNumber: number, country: string) =>
  screen
    .getByText(`${turnNumber}. ${country}`)
    .closest("[data-turn-outcome]") as HTMLElement;

/**
 * Put the seams back as a fresh page would have them. Registered by each suite
 * rather than by this module, so that importing a helper never quietly installs
 * a hook in the file that imported it.
 */
export function resetSeams(): void {
  spotifyPlayerControl.reset();
  leaderboardControl.reset();
  suggestionControl.reset();
  // Load-bearing: the Daily Run is spent the moment Competition is started, so
  // without it the second test to reach Competition finds the day already gone.
  localStorage.clear();
}
