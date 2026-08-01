import { Box, Button, Stack } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PublicIcon from "@mui/icons-material/Public";
import { GameModes } from "../../types";
import { DailyRunStatus } from "../../helpers/dailyRun";
import { COLORS } from "../../tokens";

interface MenuProps {
  gameModes: GameModes;
  /** Infinite's way in. Competition goes through the Daily Run instead. */
  setGameMode: (mode: string) => void;
  /** Today's Competition Run: still to play, half-played, or done. */
  dailyRunStatus: "none" | DailyRunStatus;
  onDailyRun: () => void;
  setShowScoreboard: (show: boolean) => void;
  setShowExplore: () => void;
}

// One control in three states, so the label is what changes and not the button.
// A finished day reopens its Run summary rather than going dead: the Run is
// already stored to make resuming work, and a player coming back at lunchtime
// most likely wants *what was that track?*, which is half the summary's job.
const DAILY_RUN_LABELS: Record<"none" | DailyRunStatus, string> = {
  none: "Competition Mode",
  "in-progress": "Resume today's Run",
  finished: "Today's Run",
};

const Menu = (props: MenuProps) => (
  <Box sx={{ mt: 4 }}>
    <Stack spacing={2} sx={{ maxWidth: 280, mx: "auto" }}>
      <Button
        variant="contained"
        size="large"
        startIcon={<EmojiEventsIcon />}
        onClick={props.onDailyRun}
      >
        {DAILY_RUN_LABELS[props.dailyRunStatus]}
      </Button>
      <Button
        variant="contained"
        size="large"
        startIcon={<AllInclusiveIcon />}
        onClick={() => props.setGameMode(props.gameModes.infinite)}
      >
        Infinite Mode
      </Button>
      {/* Not a game mode: a way into the catalogue without being tested on it. */}
      <Button
        variant="contained"
        size="large"
        startIcon={<PublicIcon />}
        onClick={props.setShowExplore}
      >
        Explore
      </Button>
      {/* The secondary action is drawn in the page's foreground, which on the
          menu is paper rather than the theme's ink: the outlined button is the
          one control here made of nothing but its own outline. */}
      <Button
        variant="outlined"
        size="large"
        startIcon={<LeaderboardIcon />}
        onClick={() => props.setShowScoreboard(true)}
        sx={{
          color: COLORS.paper,
          borderColor: COLORS.paper,
          "&:hover": {
            borderColor: COLORS.paper,
            bgcolor: "rgba(247, 245, 236, 0.12)",
          },
        }}
      >
        Scoreboard
      </Button>
    </Stack>
  </Box>
);

export default Menu;
