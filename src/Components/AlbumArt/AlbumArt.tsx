import { useState } from "react";
import { Box } from "@mui/material";
import AlbumIcon from "@mui/icons-material/Album";

interface AlbumArtProps {
  /** oEmbed thumbnail, absent until the fetch lands (and after it fails). */
  src?: string;
  alt: string;
  /** Square side, in px. */
  size?: number;
}

/**
 * A Song's artwork, with a placeholder standing in whenever there is none —
 * either because the oEmbed metadata never arrived or because the image itself
 * failed to load. Shared by the round-end reveal and the Run summary's rows, so
 * a missing thumbnail leaves the same hole in both.
 */
const AlbumArt = ({ src, alt, size = 80 }: AlbumArtProps) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 1,
          flexShrink: 0,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlbumIcon sx={{ fontSize: size / 2, color: "text.secondary" }} />
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
        width: size,
        height: size,
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
};

export default AlbumArt;
