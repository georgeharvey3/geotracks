import { Box, Typography } from "@mui/material";

import { CHROME_CLEARANCE, LANDSCAPE_MEDIA } from "../../layout";
import { NUM_COMPETITION_TURNS } from "../../state/gameReducer";
import { MONO } from "../../theme";
import { COLORS } from "../../tokens";

interface CurrentScoreProps {
  turnsRemaining: number;
  score: number;
}

/** One figure with its label, in the mono the design system keeps for figures. */
const Stat = ({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) => (
  <Box sx={{ textAlign: "left" }}>
    <Typography
      component="dt"
      variant="overline"
      sx={{
        display: "block",
        fontSize: "0.6875rem",
        lineHeight: 1.4,
        color: "text.secondary",
      }}
    >
      {label}
    </Typography>
    <Box
      component="dd"
      sx={{
        m: 0,
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: "1.875rem",
        lineHeight: 1,
        color: "text.primary",
      }}
    >
      {value}
      {suffix && (
        <Box
          component="span"
          sx={{ fontSize: "0.55em", fontWeight: 500, color: "text.secondary" }}
        >
          {suffix}
        </Box>
      )}
    </Box>
  </Box>
);

/**
 * The Competition standings, as a plaque floating over the map rather than a
 * line inside the control panel. Two reasons it sits out here: the panel is
 * where the player *acts* and the standings are only ever read, and a figure
 * given a corner of the screen to itself is prominent without having to shout —
 * it was a pair of small outlined chips crowning the panel before.
 *
 * It takes the corner furthest from the panel: bottom-left in landscape (the
 * panel floats top-right), top-right of the map band in portrait (the panel is
 * the bottom tray). A readout, not a control — the map keeps the gesture.
 */
const CurrentScore = (props: CurrentScoreProps) => {
  // Turns remaining counts down from 10, and the turn being played is the one
  // after those already retired.
  const current = Math.min(
    NUM_COMPETITION_TURNS - props.turnsRemaining + 1,
    NUM_COMPETITION_TURNS,
  );

  return (
    <Box
      component="dl"
      sx={{
        position: "absolute",
        zIndex: 2,
        m: 0,
        top: CHROME_CLEARANCE + 8,
        right: 12,
        [LANDSCAPE_MEDIA]: { top: "auto", bottom: 24, left: 24, right: "auto" },
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        px: 1.75,
        py: 1,
        borderRadius: "20px",
        // The panel's own treatment: opaque and outlined, never blurred, so it
        // stays readable over whatever the player has panned underneath it.
        border: "1.5px solid",
        borderColor: "text.primary",
        bgcolor: "background.paper",
        boxShadow: "0 14px 28px -20px rgba(18, 23, 27, 0.45)",
        pointerEvents: "none",
      }}
    >
      <Stat label="Score" value={props.score} />
      <Box
        sx={{ alignSelf: "stretch", width: "1.5px", bgcolor: COLORS.rule }}
      />
      <Stat label="Turn" value={current} suffix={`/${NUM_COMPETITION_TURNS}`} />
    </Box>
  );
};

export default CurrentScore;
