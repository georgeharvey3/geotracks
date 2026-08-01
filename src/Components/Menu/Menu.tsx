import { Box, Button, Stack } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PublicIcon from "@mui/icons-material/Public";
import { GameModes } from "../../types";
import { DayStatus } from "../../helpers/dailyRun";
import { COLORS } from "../../tokens";

interface MenuProps {
  gameModes: GameModes;
  /** Infinite's way in. Competition goes through the Daily Run instead. */
  setGameMode: (mode: string) => void;
  /** Today's Competition Run: still to play, half-played, or done. */
  dailyRunStatus: DayStatus;
  onDailyRun: () => void;
  setShowScoreboard: (show: boolean) => void;
  setShowExplore: () => void;
  setShowSuggest: () => void;
}

// The secondary tier's treatment on the night backdrop: the outlined buttons
// here are drawn in the page's own foreground, which on the menu is paper
// rather than the theme's ink. There is no third tier to reach for — a text
// link would be a rung this system does not have — so anything that is not one
// of the three primary choices wears this.
const SECONDARY_ON_NIGHT = {
  color: COLORS.paper,
  borderColor: COLORS.paper,
  "&:hover": {
    borderColor: COLORS.paper,
    bgcolor: "rgba(247, 245, 236, 0.12)",
  },
};

// One control in three states, so the label is what changes and not the button.
// A finished day reopens its Run summary rather than going dead: the Run is
// already stored to make resuming work, and a player coming back at lunchtime
// most likely wants *what was that track?*, which is half the summary's job.
const DAILY_RUN_LABELS: Record<DayStatus, string> = {
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
      <Button
        variant="outlined"
        size="large"
        startIcon={<LeaderboardIcon />}
        onClick={() => props.setShowScoreboard(true)}
        sx={SECONDARY_ON_NIGHT}
      >
        Scoreboard
      </Button>
      {/* Secondary, sitting with the scoreboard rather than becoming a fourth
          filled button: a primary here would make suggesting an album a peer of
          Competition, Infinite and Explore, and it is not one. */}
      <Button
        variant="outlined"
        size="large"
        startIcon={<LibraryMusicIcon />}
        onClick={props.setShowSuggest}
        sx={SECONDARY_ON_NIGHT}
      >
        Suggest an album
      </Button>
    </Stack>
  </Box>
);

export default Menu;
