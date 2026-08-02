import { useEffect, useState } from "react";
import { Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import AlbumArt from "../AlbumArt/AlbumArt";
import { StoredSuggestion } from "../../hooks/useAdmin";
import { countryNameByCode } from "../../map/geography";
import { MONO } from "../../theme";

interface SuggestionRowProps {
  suggestion: StoredSuggestion;
  /** Whether this Suggestion is already an Album in the Library. */
  accepted: boolean;
  onReject: () => void;
}

interface AlbumPreview {
  title?: string;
  thumbnailUrl?: string;
}

const albumUrl = (albumId: string) =>
  `https://open.spotify.com/album/${albumId}`;

/**
 * What to run to accept this one. The browser cannot: accepting writes a file
 * into the repo and ends in a commit, which is the whole shape of ADR-0005 and
 * is not something a page on the internet gets to do. So the button hands over
 * the command instead, and the terminal stays the only thing that can change the
 * Library.
 */
const acceptCommand = (suggestion: StoredSuggestion) =>
  `node scripts/add-community-album.ts ${suggestion.albumId} ${suggestion.countryCode}`;

/**
 * One Suggestion, as something to make a decision about.
 *
 * The album's title and artwork come from Spotify's **oEmbed** endpoint, which
 * is public and takes no credentials — the same endpoint `useSpotifyPlayer`
 * already reads a Song's metadata from. That matters here: the client could not
 * use the catalogue API if it wanted to, because the credentials for it are the
 * one thing in this repo that must never reach a browser.
 */
const SuggestionRow = (props: SuggestionRowProps) => {
  const { suggestion } = props;
  const [preview, setPreview] = useState<AlbumPreview>({});
  const [copied, setCopied] = useState(false);
  // Reject deletes the record outright and there is no undo, so it takes two
  // clicks. Arm-then-commit rather than a confirmation dialog: the app has no
  // `Dialog` anywhere and `design.md` is locked, and this is the same shape the
  // map already uses on touch to protect a Guess.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let live = true;
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      albumUrl(suggestion.albumId),
    )}`;

    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // Best-effort throughout: an album that will not resolve is still a row
        // with a country, a note and a link, which is enough to judge it by.
        if (live && data) {
          setPreview({ title: data.title, thumbnailUrl: data.thumbnail_url });
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [suggestion.albumId]);

  const copy = () => {
    navigator.clipboard?.writeText(acceptCommand(suggestion)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const country = countryNameByCode(suggestion.countryCode);

  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        gap: 2,
        py: 2,
        listStyle: "none",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <AlbumArt src={preview.thumbnailUrl} alt="" size={72} />

      <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {preview.title ?? "Untitled album"}
        </Typography>

        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {country ?? `Unknown country (${suggestion.countryCode})`}
          {" · "}
          <Box component="span" sx={{ fontFamily: MONO }}>
            {new Date(suggestion.createdAt).toISOString().slice(0, 10)}
          </Box>
        </Typography>

        {suggestion.note && (
          <Typography variant="body2">{suggestion.note}</Typography>
        )}

        <Box>
          <Link
            href={albumUrl(suggestion.albumId)}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            Open in Spotify
            <OpenInNewIcon sx={{ fontSize: "1rem" }} />
          </Link>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
          {props.accepted ? (
            <Chip size="small" label="In the Library" />
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<ContentCopyIcon />}
              onClick={copy}
            >
              {copied ? "Command copied" : "Copy accept command"}
            </Button>
          )}
          <Button
            size="small"
            variant={armed ? "contained" : "outlined"}
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              if (armed) props.onReject();
              else setArmed(true);
            }}
          >
            {armed ? "Reject for good" : "Reject"}
          </Button>
          {armed && (
            <Button size="small" onClick={() => setArmed(false)}>
              Keep
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default SuggestionRow;
