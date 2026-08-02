import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import AlbumArt from "../AlbumArt/AlbumArt";
import { AcceptOutcome, StoredSuggestion } from "../../hooks/useAdmin";
import { countryNameByCode } from "../../map/geography";
import { nextDay } from "../../music/acceptance";
import { MONO } from "../../theme";

interface SuggestionRowProps {
  suggestion: StoredSuggestion;
  onReject: () => void;
  /** Accept it, live from the given date. Resolves with what happened. */
  onAccept: (liveFrom: string) => Promise<AcceptOutcome>;
  /** Accepting reads the album's tracks, which needs the reviewer's Spotify. */
  canAccept: boolean;
}

interface AlbumPreview {
  title?: string;
  thumbnailUrl?: string;
}

const albumUrl = (albumId: string) =>
  `https://open.spotify.com/album/${albumId}`;

/**
 * What to run to accept this one from a terminal instead.
 *
 * The screen can accept by itself now (ADR-0008), so this is no longer the only
 * way — but the script still does two things this cannot: `--live-from` for a
 * date other than tomorrow, and adding an album nobody suggested. It is a small
 * text button rather than the loud one it used to be.
 */
const acceptCommand = (suggestion: StoredSuggestion) =>
  `node scripts/add-community-album.ts ${suggestion.albumId} ${suggestion.countryCode}`;

/** Every way accepting can fail, said in a way that can be acted on. */
function refusal(outcome: Extract<AcceptOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case "duplicate":
      return `Already in the Library, as "${outcome.albumName}".`;
    case "unauthorized":
      return "Spotify wouldn't accept that token. Connect again, then retry.";
    case "missing":
      return "Spotify has no tracks for this album.";
    case "spotify":
      return "Couldn't reach Spotify. Try again.";
    case "country":
      return "This names a country code the app doesn't have.";
    case "write":
      return "The database refused the write. Nothing was accepted.";
  }
}

/**
 * One Suggestion, as something to make a decision about.
 *
 * The album's title and artwork come from Spotify's **oEmbed** endpoint, which
 * is public and takes no credentials — the same endpoint `useSpotifyPlayer`
 * already reads a Song's metadata from. The track list, which is what accepting
 * actually needs, comes from the catalogue API with the reviewer's own token
 * (ADR-0008); oEmbed has never had it.
 *
 * **Both decisions arm before they commit.** Rejecting deletes a record with no
 * undo; accepting publishes an album into a Library where, once its `liveFrom`
 * has passed, it can no longer be taken out without changing somebody's day.
 * Neither is a `Dialog`, because the app has none anywhere and `design.md` is
 * locked — it is the shape the map already uses on touch to protect a Guess.
 */
const SuggestionRow = (props: SuggestionRowProps) => {
  const { suggestion } = props;
  const [preview, setPreview] = useState<AlbumPreview>({});
  const [copied, setCopied] = useState(false);
  // Which decision, if either, has been armed. One at a time: arming the other
  // disarms this one, so there is never a row offering two irreversible things.
  const [armed, setArmed] = useState<"accept" | "reject" | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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

  // Tomorrow, computed at the moment of the click rather than held from when the
  // row mounted: `liveFrom` is authored *ahead* so nobody anywhere has passed it
  // yet, and a queue left open across midnight would otherwise write a date that
  // some players' day has already gone past. Same rule as the script's default.
  const accept = () => {
    setAccepting(true);
    setFailure(null);
    props
      .onAccept(nextDay(new Date()))
      .then(
        (outcome) => {
          // Nothing to report on success: the accepted Suggestion is deleted in
          // the same write, so this row is on its way out of the queue.
          if (!outcome.ok) setFailure(refusal(outcome));
        },
        () => setFailure(refusal({ ok: false, reason: "write" })),
      )
      .finally(() => {
        setAccepting(false);
        setArmed(null);
      });
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

        {/* What accepting will do, said before it is done rather than after:
            the album plays in Explore and Infinite immediately, and joins the
            Daily Run's pool only once every player has crossed the date. */}
        {armed === "accept" && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Goes live in Explore and Infinite at once, and in Competition from{" "}
            <Box component="span" sx={{ fontFamily: MONO }}>
              {nextDay(new Date())}
            </Box>
            .
          </Typography>
        )}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{ pt: 0.5 }}
        >
          {/* There is no "already accepted" state to show: accepting deletes
              the Suggestion in the same write that stores the album, so an
              accepted one is gone from this queue rather than marked in it. */}
          <Button
            size="small"
            variant="contained"
            disabled={!props.canAccept || accepting}
            startIcon={
              accepting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckIcon />
              )
            }
            onClick={() => {
              if (armed === "accept") accept();
              else setArmed("accept");
            }}
          >
            {accepting
              ? "Accepting…"
              : armed === "accept"
                ? "Add to the Library"
                : "Accept"}
          </Button>

          <Button
            size="small"
            variant={armed === "reject" ? "contained" : "outlined"}
            color="error"
            disabled={accepting}
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              if (armed === "reject") props.onReject();
              else setArmed("reject");
            }}
          >
            {armed === "reject" ? "Reject for good" : "Reject"}
          </Button>

          {armed !== null && (
            <Button size="small" onClick={() => setArmed(null)}>
              {armed === "reject" ? "Keep" : "Cancel"}
            </Button>
          )}

          {armed === null && (
            <Button
              size="small"
              color="inherit"
              startIcon={<ContentCopyIcon />}
              onClick={copy}
            >
              {copied ? "Command copied" : "Copy command"}
            </Button>
          )}
        </Stack>

        {failure && (
          <Typography variant="body2" sx={{ color: "error.main" }}>
            {failure}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default SuggestionRow;
