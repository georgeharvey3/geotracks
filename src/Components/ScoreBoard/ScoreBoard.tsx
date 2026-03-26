import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from "@mui/material";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import { ScoreEntry } from "../../types";

interface ScoreboardProps {
  scores: ScoreEntry[];
}

const getRankColor = (index: number) => {
  if (index === 0) return "warning.main";
  if (index === 1) return "text.secondary";
  if (index === 2) return "#cd7f32";
  return "text.disabled";
};

const Scoreboard = (props: ScoreboardProps) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
        <LeaderboardIcon sx={{ color: "primary.main" }} />
        <Typography variant="h2">Top Scores</Typography>
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 400, mx: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Score
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.scores.map((score, index) => (
              <TableRow
                key={score.name}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                }}
              >
                <TableCell>
                  <Chip
                    label={index + 1}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      color: getRankColor(index),
                      bgcolor: "transparent",
                      fontSize: "0.875rem",
                    }}
                  />
                </TableCell>
                <TableCell>{score.name}</TableCell>
                <TableCell align="right">
                  <Typography
                    component="span"
                    sx={{ fontWeight: 600, color: "primary.main" }}
                  >
                    {score.score}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Scoreboard;
