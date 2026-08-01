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
import { MONO } from "../../theme";
import { COLORS } from "../../tokens";
import { ScoreEntry } from "../../types";

interface ScoreboardProps {
  scores: ScoreEntry[];
}

// A medal is carried by a filled chip rather than by coloured text: none of the
// three metals clears 4.5:1 as text on cream, and as a fill each one takes an
// ink label at better than 6:1. Ranks past third get no fill at all, so the
// medals are the only thing on the column with colour.
const MEDAL_FILLS = [COLORS.gold, COLORS.silver, COLORS.bronze];

const Scoreboard = (props: ScoreboardProps) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          mb: 2,
        }}
      >
        {/* Inherits the page's foreground: this heading sits on the night
            backdrop, unlike the table below it, which is its own cream card. */}
        <LeaderboardIcon sx={{ color: "inherit" }} />
        <Typography variant="h2">Top Scores</Typography>
      </Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxWidth: 400, mx: "auto" }}
      >
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
                key={score.id ?? score.name}
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
                      color: "text.primary",
                      bgcolor: MEDAL_FILLS[index] ?? "transparent",
                      fontSize: "0.875rem",
                    }}
                  />
                </TableCell>
                <TableCell>{score.name}</TableCell>
                <TableCell align="right">
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 600,
                      fontFamily: MONO,
                    }}
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
