import { Box, Button, Stack } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import { GameModes } from "../../types";

interface MenuProps {
  gameModes: GameModes;
  setGameMode: (mode: string) => void;
  setShowScoreboard: (show: boolean) => void;
}

const Menu = (props: MenuProps) => (
  <Box sx={{ mt: 4 }}>
    <Stack spacing={2} sx={{ maxWidth: 280, mx: "auto" }}>
      <Button
        variant="contained"
        size="large"
        startIcon={<EmojiEventsIcon />}
        onClick={() => props.setGameMode(props.gameModes.competition)}
      >
        Competition Mode
      </Button>
      <Button
        variant="contained"
        size="large"
        startIcon={<AllInclusiveIcon />}
        onClick={() => props.setGameMode(props.gameModes.infinite)}
      >
        Infinite Mode
      </Button>
      <Button
        variant="outlined"
        size="large"
        startIcon={<LeaderboardIcon />}
        onClick={() => props.setShowScoreboard(true)}
      >
        Scoreboard
      </Button>
    </Stack>
  </Box>
);

export default Menu;
