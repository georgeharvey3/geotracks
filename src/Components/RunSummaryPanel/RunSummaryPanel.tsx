import React from "react";
import {
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SaveIcon from "@mui/icons-material/Save";

import PanelSurface from "../PanelSurface/PanelSurface";
import TurnResultRow from "../TurnResultRow/TurnResultRow";
import { NUM_COMPETITION_TURNS } from "../../state/gameReducer";
import { TurnResult } from "../../types";

interface RunSummaryPanelProps {
  score: number;
  /** One entry per turn of the Run, in the order they were played. */
  turns: TurnResult[];
  nameInputValue: string;
  onNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScoreFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** True while the leaderboard write is in flight. */
  saving: boolean;
  /** True once this Run's score is on the leaderboard: one write per Run. */
  saved: boolean;
  /** True when the last attempt to save failed, so the player can try again. */
  saveFailed: boolean;
  onShowLeaderboard: () => void;
  /** Lights a row's country on the map (pointer devices only). */
  onRowHoverChange: (country: string | null) => void;
}

/**
 * The Run summary's panel: how the player did, the one chance to put the score
 * on the leaderboard, and what every Song was.
 *
 * The order is deliberate. The score and the named count come first, because
 * that is what the player asks on arrival; the name box comes second so that it,
 * and the confirmation that replaces it, are above the fold on any device and ten
 * rows can never bury the submit. The rows scroll inside the panel underneath.
 */
const RunSummaryPanel = (props: RunSummaryPanelProps) => {
  const named = props.turns.filter(
    (result) => result.outcome !== "missed",
  ).length;

  return (
    <PanelSurface>
      <EmojiEventsIcon sx={{ fontSize: 40, color: "warning.main" }} />
      <Typography variant="h2" sx={{ fontSize: "1.75rem" }}>
        {props.score} points
      </Typography>
      {/* The score alone doesn't say whether it came from lucky third guesses or
          clean first ones. */}
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        {named} of {NUM_COMPETITION_TURNS} named
      </Typography>

      {props.saved ? (
        <Stack spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CheckCircleIcon fontSize="small" color="success" />
            <Typography variant="body2">
              Saved as {props.nameInputValue}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EmojiEventsIcon />}
            onClick={props.onShowLeaderboard}
          >
            Leaderboard
          </Button>
        </Stack>
      ) : (
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: 0.75 }}
          >
            Submit your name to the leaderboard
          </Typography>
          <form onSubmit={props.onScoreFormSubmit}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                placeholder="Name..."
                name="score"
                value={props.nameInputValue}
                onChange={props.onNameInputChange}
                size="small"
                fullWidth
                slotProps={{
                  htmlInput: { maxLength: 10 },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "background.default",
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={props.saving || !props.nameInputValue.trim()}
              >
                Save
              </Button>
            </Box>
          </form>
          {props.saveFailed && (
            <Typography variant="caption" sx={{ color: "error.main" }}>
              Couldn&apos;t save your score. Try again.
            </Typography>
          )}
        </Box>
      )}

      <Divider sx={{ mb: 1.5 }} />

      <Stack spacing={1}>
        {props.turns.map((result, index) => (
          <TurnResultRow
            // The same Song can only recur across Runs, never within one, but the
            // index is in the key regardless: the rows are an ordered record.
            key={`${index}-${result.song.link}`}
            result={result}
            turnNumber={index + 1}
            onHoverChange={props.onRowHoverChange}
          />
        ))}
      </Stack>
    </PanelSurface>
  );
};

export default RunSummaryPanel;
