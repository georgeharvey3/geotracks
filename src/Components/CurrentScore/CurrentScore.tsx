import { Box, Chip, Stack } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import StarIcon from "@mui/icons-material/Star";

interface CurrentScoreProps {
  turnsRemaining: number;
  score: number;
}

const CurrentScore = (props: CurrentScoreProps) => (
  <Box sx={{ mb: 1.5 }}>
    <Stack direction="row" spacing={1} justifyContent="center">
      <Chip
        size="small"
        icon={<TimerIcon />}
        label={`Turns: ${props.turnsRemaining}`}
        variant="outlined"
        color="primary"
      />
      <Chip
        size="small"
        icon={<StarIcon />}
        label={`Score: ${props.score}`}
        variant="outlined"
        color="secondary"
      />
    </Stack>
  </Box>
);

export default CurrentScore;
