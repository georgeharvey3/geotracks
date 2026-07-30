import React, { useState } from "react";

import RunSummary from "../RunSummary/RunSummary";
import { useGame, useLeaderboard } from "../../context/GameContext";

/**
 * Container for the Run summary. Owns the leaderboard write — the one
 * side-effect on this screen — and wires it to the game reducer via context, so
 * <RunSummary> stays purely presentational.
 *
 * The write is confirmed in place rather than by reloading the page: the recap
 * the player is reading sits on the same screen as the name box.
 */
const RunSummaryScreen = () => {
  const { state, dispatch } = useGame();
  const leaderboard = useLeaderboard();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const onScoreFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // One write per Run, so a second submit is not a second record.
    if (saving || state.scoreSubmitted) return;

    setSaving(true);
    setSaveFailed(false);
    try {
      await leaderboard.submitScore(state.nameInputValue, state.score);
      dispatch({ type: "SCORE_SUBMITTED" });
    } catch (error) {
      // The Run is still on screen and still submittable: say so and let the
      // player try again rather than losing their score to a dropped write.
      console.error("[RunSummaryScreen] leaderboard write failed:", error);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RunSummary
      score={state.score}
      turns={state.turns}
      nameInputValue={state.nameInputValue}
      onNameInputChange={(e) =>
        dispatch({ type: "SET_NAME", value: e.target.value })
      }
      onScoreFormSubmit={onScoreFormSubmit}
      saving={saving}
      saved={state.scoreSubmitted}
      saveFailed={saveFailed}
      onShowLeaderboard={() => dispatch({ type: "SHOW_SCOREBOARD" })}
    />
  );
};

export default RunSummaryScreen;
