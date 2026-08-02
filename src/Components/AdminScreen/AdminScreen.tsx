import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

import Admin from "../Admin/Admin";
import useAdmin from "../../hooks/useAdmin";
import { COLORS } from "../../tokens";

/**
 * Container for the Suggestion review screen: the read/reject seam wired to the
 * queue.
 *
 * A seventh screen in the content-page family, and the first with no way in
 * from the app — no menu button, no link, nothing. It is reached by the `#admin`
 * hash, which is a **convenience and not a secret**: the thing that decides who
 * sees anything is `database.rules.json`, and it decides on the server.
 */
const AdminScreen = () => {
  const admin = useAdmin();

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
        Accepting one is a commit; this screen hands you the command.
      </Typography>

      <Admin {...admin} />
    </Box>
  );
};

export default AdminScreen;
