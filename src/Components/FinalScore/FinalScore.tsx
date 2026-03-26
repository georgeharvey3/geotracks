import React from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SaveIcon from "@mui/icons-material/Save";

interface FinalScoreProps {
  score: number;
  setGameMode: (mode: string) => void;
  nameInputValue: string;
  onNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScoreFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const FinalScore = (props: FinalScoreProps) => (
  <Box sx={{ mt: 4 }}>
    <Paper
      elevation={3}
      sx={{
        p: 4,
        maxWidth: 360,
        mx: "auto",
        textAlign: "center",
      }}
    >
      <EmojiEventsIcon sx={{ fontSize: 48, color: "warning.main", mb: 1 }} />
      <Typography variant="h2" gutterBottom>
        {props.score} points
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
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
            disabled={!props.nameInputValue.trim()}
          >
            Save
          </Button>
        </Box>
      </form>
    </Paper>
  </Box>
);

export default FinalScore;
