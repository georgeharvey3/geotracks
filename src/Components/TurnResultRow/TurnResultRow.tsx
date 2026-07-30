import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import ExploreIcon from "@mui/icons-material/Explore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import AlbumArt from "../AlbumArt/AlbumArt";
import { OUTCOME_FILLS } from "../../map/fills";
import { TurnResult } from "../../types";

const ART_SIZE = 56;

/** What the turn's outcome is called, in the same words the map's fills mean. */
function outcomeLabel(result: TurnResult): string {
  switch (result.outcome) {
    case "named-first":
      return "Named first guess";
    case "named-later":
      return `Named on guess ${result.attempts}`;
    case "missed":
      return `Missed in ${result.attempts} guesses`;
  }
}

interface TurnResultRowProps {
  result: TurnResult;
  /** 1-based turn number, so the rows read as the Run in order. */
  turnNumber: number;
  /** Lights this row's country on the map (pointer devices only). */
  onHoverChange: (country: string | null) => void;
}

/**
 * One turn of the Run: what the Song was, where it came from, and how the turn
 * went. The country is printed rather than only shown on the map, because
 * hovering a row is a pointer's privilege and the row must answer "where was
 * that from?" on a touch screen too.
 */
const TurnResultRow = (props: TurnResultRowProps) => {
  const { result } = props;
  const country = result.song.country;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      data-turn-outcome={result.outcome}
      onMouseEnter={() => props.onHoverChange(country)}
      onMouseLeave={() => props.onHoverChange(null)}
      sx={{
        p: 1,
        textAlign: "left",
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        // The outcome colour is the map's own, so a row and its country are read
        // as the same mark.
        borderLeft: "4px solid",
        borderLeftColor: OUTCOME_FILLS[result.outcome],
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <AlbumArt
        src={result.song.thumbnailUrl}
        alt={result.song.album}
        size={ART_SIZE}
      />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          spacing={1}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            {props.turnNumber}. {country}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", flexShrink: 0 }}
          >
            {result.points} pts
          </Typography>
        </Stack>

        <Typography variant="body2" noWrap>
          {result.song.trackTitle || "Unknown Track"}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
          {result.song.artistName || "Unknown Artist"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
          noWrap
        >
          {result.song.album}
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          flexWrap="wrap"
          sx={{ mt: 0.5 }}
        >
          <Typography variant="caption">{outcomeLabel(result)}</Typography>
          {result.geoHintsUsed && (
            // The only thing that explains a halved points figure.
            <Chip
              icon={<ExploreIcon />}
              label="GeoHints"
              size="small"
              variant="outlined"
              title="GeoHints were on for this turn — half points"
            />
          )}
          <Link
            href={result.song.link}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
            Spotify
          </Link>
        </Stack>
      </Box>
    </Stack>
  );
};

export default TurnResultRow;
