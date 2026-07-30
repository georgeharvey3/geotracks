import React, { useState } from "react";
import { Box } from "@mui/material";

import RunSummaryMap from "../RunSummaryMap/RunSummaryMap";
import RunSummaryPanel from "../RunSummaryPanel/RunSummaryPanel";
import useHasHover from "../../hooks/useHasHover";
import { TurnResult } from "../../types";

interface RunSummaryProps {
  score: number;
  turns: TurnResult[];
  nameInputValue: string;
  onNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScoreFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  saved: boolean;
  saveFailed: boolean;
  onShowLeaderboard: () => void;
}

/**
 * The Run summary screen, laid out exactly as the game and Explore screens are:
 * in landscape the map covers the viewport and the panel floats over a corner of
 * it; in portrait they stack, the panel a tray that scrolls its rows within its
 * own cap. No player mounts here — the rows identify each Song and hand off to
 * Spotify, and Explore is where the music is actually listened to.
 *
 * The row-to-map link lives here because it belongs to neither half alone: it is
 * pointer-only, since on touch there is no hover to give and the country printed
 * in each row carries the job instead.
 */
const RunSummary = (props: RunSummaryProps) => {
  const hasHover = useHasHover();
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(
    null,
  );

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ flex: "1 1 auto", minHeight: 0 }}>
        <RunSummaryMap
          turns={props.turns}
          highlightedCountry={highlightedCountry}
        />
      </Box>

      <RunSummaryPanel
        score={props.score}
        turns={props.turns}
        nameInputValue={props.nameInputValue}
        onNameInputChange={props.onNameInputChange}
        onScoreFormSubmit={props.onScoreFormSubmit}
        saving={props.saving}
        saved={props.saved}
        saveFailed={props.saveFailed}
        onShowLeaderboard={props.onShowLeaderboard}
        onRowHoverChange={(country) =>
          setHighlightedCountry(hasHover ? country : null)
        }
      />
    </Box>
  );
};

export default RunSummary;
