import { vi } from "vitest";
import type { NewSuggestion, Suggestions } from "../hooks/useSuggestions";

/**
 * Controllable fake for the `useSuggestions` seam — the one mocking boundary
 * this feature adds, beside `leaderboardFake`. It records what was submitted and
 * lets a test make the next write fail, which is the only way the form's
 * retryable failure state can be reached without a network.
 *
 * Nothing is read back: the real hook writes and never reads, so a fake that
 * offered a list would be inventing a capability the app does not have.
 */

let failWith: Error | null = null;

const submitSuggestion = vi.fn(async (_suggestion: NewSuggestion) => {
  if (failWith) throw failWith;
});

export const suggestionControl = {
  submitSuggestion,
  /** The Suggestions submitted so far, oldest first. */
  submitted: (): NewSuggestion[] =>
    submitSuggestion.mock.calls.map(([suggestion]) => suggestion),
  /** Make every write fail until `reset`. */
  failWrites: (error = new Error("write failed")) => {
    failWith = error;
  },
  reset: () => {
    failWith = null;
    submitSuggestion.mockClear();
  },
};

// Mock implementation swapped in for the default export of useSuggestions.
export default function useSuggestionsFake(): Suggestions {
  return { submitSuggestion };
}
