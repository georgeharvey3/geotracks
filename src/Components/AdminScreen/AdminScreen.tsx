import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

import Admin from "../Admin/Admin";
import useAdmin from "../../hooks/useAdmin";
import useSpotifyAuth from "../../hooks/useSpotifyAuth";
import { COLORS } from "../../tokens";

/**
 * Container for the Suggestion review screen: the read/reject/accept seam and
 * the reviewer's Spotify session, wired to the queue.
 *
 * A seventh screen in the content-page family, and the first with no way in
 * from the app — no menu button, no link, nothing. It is reached by the `#admin`
 * hash, which is a **convenience and not a secret**: the thing that decides who
 * sees anything is `database.rules.json`, and it decides on the server.
 *
 * Two seams rather than one because they answer different questions and fail
 * separately: Google says who may see the queue, Spotify only says how an album
 * gets read. Everything but accepting works with no Spotify at all.
 */
const AdminScreen = () => {
  const admin = useAdmin();
  const spotify = useSpotifyAuth();

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          mb: 1,
        }}
      >
        {/* Inherits the page's foreground: this heading stands on the night
            backdrop, unlike the card below it, which is its own cream surface. */}
        <InboxIcon sx={{ color: "inherit" }} />
        <Typography variant="h2">Suggestions</Typography>
      </Box>
      {/* Secondary copy on the night backdrop is `paperMuted`, the mirror of
          the app pages' `inkMuted` — not the page's paper at reduced opacity. */}
      <Typography variant="body2" sx={{ mb: 2, color: COLORS.paperMuted }}>
        Accepting one adds it to the Library; rejecting deletes it.
      </Typography>

      <Admin {...admin} spotify={spotify} />
    </Box>
  );
};

export default AdminScreen;
