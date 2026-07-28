import { useState } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import AlbumIcon from "@mui/icons-material/Album";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Song } from "../../types";

const AlbumArt = ({ src, alt }: { src?: string; alt: string }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          flexShrink: 0,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlbumIcon sx={{ fontSize: 40, color: "text.secondary" }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      sx={{
        width: 80,
        height: 80,
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
};

// The answer-reveal card: album art plus track/artist/album and a Spotify link.
const TrackReveal = ({ song }: { song: Song }) => (
  <Paper
    variant="outlined"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      p: 1.5,
      width: "100%",
      maxWidth: 400,
    }}
  >
    <AlbumArt src={song.thumbnailUrl} alt={song.album} />
    <Box sx={{ minWidth: 0, overflow: "hidden" }}>
      <Typography
        variant="body1"
        sx={{
          fontWeight: "bold",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
        noWrap
      >
        {song.trackTitle || "Unknown Track"}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
        noWrap
      >
        {song.artistName || "Unknown Artist"}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textOverflow: "ellipsis",
          overflow: "hidden",
          display: "block",
        }}
        noWrap
      >
        {song.album}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <Button
          size="small"
          href={song.link}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: "none", p: 0, minWidth: 0 }}
        >
          Open in Spotify
        </Button>
      </Box>
    </Box>
  </Paper>
);

export default TrackReveal;
