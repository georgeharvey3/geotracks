import { Box, Chip, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import NorthIcon from "@mui/icons-material/North";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import EastIcon from "@mui/icons-material/East";
import SouthEastIcon from "@mui/icons-material/SouthEast";
import SouthIcon from "@mui/icons-material/South";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import WestIcon from "@mui/icons-material/West";
import NorthWestIcon from "@mui/icons-material/NorthWest";

import { Guess, Direction } from "../../types";

const directionIconMap: Record<Direction, React.ReactElement> = {
  N: <NorthIcon fontSize="small" />,
  NE: <NorthEastIcon fontSize="small" />,
  E: <EastIcon fontSize="small" />,
  SE: <SouthEastIcon fontSize="small" />,
  S: <SouthIcon fontSize="small" />,
  SW: <SouthWestIcon fontSize="small" />,
  W: <WestIcon fontSize="small" />,
  NW: <NorthWestIcon fontSize="small" />,
};

interface GuessesProps {
  guesses: Guess[];
  showGeoHints: boolean;
}

const Guesses = (props: GuessesProps) => {
  return (
    <Stack spacing={1} sx={{ my: 2, maxWidth: 360, mx: "auto" }}>
      {props.guesses.map((guess, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            borderRadius: 1,
            bgcolor: guess.correct
              ? "rgba(102, 187, 106, 0.12)"
              : "rgba(244, 67, 54, 0.08)",
            border: "1px solid",
            borderColor: guess.correct
              ? "rgba(102, 187, 106, 0.3)"
              : "rgba(244, 67, 54, 0.2)",
          }}
        >
          <Typography variant="body2">{guess.country}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {guess.correct ? (
              <CheckCircleIcon sx={{ color: "success.main", fontSize: 20 }} />
            ) : (
              <>
                {props.showGeoHints && (
                  <>
                    <Chip
                      label={`${guess.distance!.toFixed()} km`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.75rem", height: 24 }}
                    />
                    <Box
                      sx={{
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {directionIconMap[guess.direction as Direction]}
                    </Box>
                  </>
                )}
                <CancelIcon sx={{ color: "error.main", fontSize: 20 }} />
              </>
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

export default Guesses;
