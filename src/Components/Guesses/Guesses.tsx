import { useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

const GuessRow = ({
  guess,
  showGeoHints,
}: {
  guess: Guess;
  showGeoHints: boolean;
}) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      px: 1.5,
      py: 0.5,
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
          {showGeoHints && (
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
);

interface GuessesProps {
  guesses: Guess[];
  showGeoHints: boolean;
  /**
   * The round is over. The reveal and the Next Song button need the room more
   * than the history does, so the board folds itself back up.
   */
  roundOver: boolean;
}

/**
 * The running board of this round's guesses, collapsed by default to its most
 * recent entry — the one the player is reacting to. The rest are one tap away,
 * and fold away again when the round ends. The map already carries the full
 * history, so the panel's job here is to stay small enough that nothing else in
 * it has to scroll.
 */
const Guesses = (props: GuessesProps) => {
  const [expanded, setExpanded] = useState(false);

  const { roundOver } = props;
  useEffect(() => {
    if (roundOver) setExpanded(false);
  }, [roundOver]);

  const latest = props.guesses[props.guesses.length - 1];
  if (!latest) return null;

  const hiddenCount = props.guesses.length - 1;
  const shown = expanded ? props.guesses : [latest];

  return (
    <Stack spacing={0.5} sx={{ mt: 1.5, mx: "auto" }}>
      {shown.map((guess, index) => (
        <GuessRow key={index} guess={guess} showGeoHints={props.showGeoHints} />
      ))}

      {hiddenCount > 0 && (
        <Button
          size="small"
          onClick={() => setExpanded((current) => !current)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ alignSelf: "center", textTransform: "none", py: 0 }}
        >
          {expanded
            ? "Hide earlier guesses"
            : `Show ${hiddenCount} earlier ${
                hiddenCount === 1 ? "guess" : "guesses"
              }`}
        </Button>
      )}
    </Stack>
  );
};

export default Guesses;
