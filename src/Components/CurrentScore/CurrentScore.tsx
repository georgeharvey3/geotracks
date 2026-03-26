import { Box, Chip, Stack } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import StarIcon from "@mui/icons-material/Star";

interface CurrentScoreProps {
  turnsRemaining: number;
  score: number;
}

const CurrentScore = (props: CurrentScoreProps) => (
  <Box sx={{ mb: 2 }}>
    <Stack direction="row" spacing={2} justifyContent="center">
      <Chip
        icon={<TimerIcon />}
        label={`Turns: ${props.turnsRemaining}`}
        variant="outlined"
        color="primary"
      />
      <Chip
        icon={<StarIcon />}
        label={`Score: ${props.score}`}
        variant="outlined"
        color="secondary"
      />
    </Stack>
  </Box>
);

export default CurrentScore;
