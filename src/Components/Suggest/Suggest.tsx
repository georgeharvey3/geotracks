import React, { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import SendIcon from "@mui/icons-material/Send";

import CountryAutocomplete from "../CountryAutocomplete/CountryAutocomplete";
import Spinner from "../Spinner/Spinner";
import { extractAlbumId } from "../../helpers/spotifyAlbum";
import { countryCodeByName } from "../../map/geography";
import { NewSuggestion } from "../../hooks/useSuggestions";

/** Matches the `.validate` rule on `suggestions/$id/note`. */
const NOTE_MAX = 500;

/** Where the counter starts being worth showing. */
const NOTE_COUNTER_FROM = NOTE_MAX - 100;

interface SuggestProps {
  /**
   * The country the screen opened on, by name — Explore passes the one the
   * player asked about; the menu passes none.
   */
  initialCountry: string;
  /** Resolves when the Suggestion is stored, rejects when the write fails. */
  onSubmit: (suggestion: NewSuggestion) => Promise<void>;
}

type Status = "editing" | "sending" | "sent" | "failed";

const EMPTY = { link: "", country: "", note: "" };

/**
 * The Suggestion form: a player proposing that the app add an Album.
 *
 * **It asks only for what Spotify cannot tell you.** Given an album id, the
 * accept script fetches the album's name, its artist and every track URL; what
 * it can never fetch is which country the music belongs to, or why. So this is
 * a link, a country and a note, and it must never ask for an album name — a
 * field the person can get wrong about something the machine knows for certain.
 *
 * A content page, so it stands on the night backdrop and draws its chrome in
 * paper. The `Paper` card is load-bearing rather than decorative: `TextField`
 * in this app is cream, and unwrapped on the night these would be three cream
 * boxes floating on black with no surface underneath them.
 */
const Suggest = (props: SuggestProps) => {
  const [fields, setFields] = useState({
    ...EMPTY,
    country: props.initialCountry,
  });
  const [status, setStatus] = useState<Status>("editing");

  const link = extractAlbumId(fields.link);
  const countryCode = countryCodeByName(fields.country);
  const sending = status === "sending";

  // Nothing is said about an empty box: the person has not got it wrong yet.
  const linkError =
    fields.link.trim() === "" || link.ok
      ? ""
      : link.reason === "track"
        ? "That's a track link — paste the album instead."
        : "That doesn't look like a Spotify album link.";

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!link.ok || countryCode === undefined || sending) return;

    setStatus("sending");
    try {
      await props.onSubmit({
        albumId: link.albumId,
        countryCode,
        // Blank is left out of the record entirely rather than written as "".
        ...(fields.note.trim() ? { note: fields.note.trim() } : {}),
      });
      setStatus("sent");
    } catch {
      // The typed values stay exactly where they are: a failed write is
      // something to try again, not something to retype.
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <Card>
        <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
          <LibraryMusicIcon />
          <Typography variant="h3" sx={{ fontSize: "1.125rem" }}>
            Suggestion received
          </Typography>
          {/* Honest rather than warm: there is no reply coming, because the
              form never asked for anywhere to send one. */}
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            A human reads these and adds the ones that fit. There's no reply and
            no timeline — but it has been written down.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setFields(EMPTY);
              setStatus("editing");
            }}
          >
            Suggest another
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Field id="suggest-link" label="Album on Spotify">
            <TextField
              id="suggest-link"
              value={fields.link}
              onChange={(e) => set("link")(e.target.value)}
              placeholder="https://open.spotify.com/album/…"
              disabled={sending}
              size="small"
              fullWidth
              error={linkError !== ""}
              helperText={linkError || " "}
            />
          </Field>

          <Field id="suggest-country" label="Country the music comes from">
            <CountryAutocomplete
              id="suggest-country"
              value={fields.country}
              onChange={set("country")}
              disabled={sending}
            />
          </Field>

          <Field id="suggest-note" label="Why (optional)">
            <TextField
              id="suggest-note"
              value={fields.note}
              onChange={(e) => set("note")(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Anything that would help us place it"
              disabled={sending}
              size="small"
              fullWidth
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
            />
            {fields.note.length >= NOTE_COUNTER_FROM && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 0.5,
                  textAlign: "right",
                  color: "text.secondary",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {fields.note.length}/{NOTE_MAX}
              </Typography>
            )}
          </Field>

          {status === "failed" && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              That didn't send. Nothing is lost — try again.
            </Typography>
          )}

          <Box sx={{ display: "flex", justifyContent: "center", pt: 0.5 }}>
            {sending ? (
              <Spinner />
            ) : (
              <Button
                type="submit"
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!link.ok || countryCode === undefined}
              >
                {status === "failed" ? "Try again" : "Send suggestion"}
              </Button>
            )}
          </Box>
        </Stack>
      </form>
    </Card>
  );
};

/** The cream surface the fields stand on, cut out of the night. */
const Card = ({ children }: { children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ maxWidth: 440, mx: "auto", p: 2.5 }}>
    {children}
  </Paper>
);

/** One labelled row. The app labels above the box, never floating inside it. */
const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) => (
  <Box sx={{ textAlign: "left" }}>
    <Typography
      variant="body2"
      component="label"
      htmlFor={id}
      sx={{ display: "block", fontWeight: 600, mb: 0.5 }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

export default Suggest;
