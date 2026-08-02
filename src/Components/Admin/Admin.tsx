import { useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

import SuggestionRow from "../SuggestionRow/SuggestionRow";
import Spinner from "../Spinner/Spinner";
import { Admin as AdminSeam } from "../../hooks/useAdmin";
import { MONO } from "../../theme";

/**
 * The Suggestion review queue.
 *
 * **This screen is not what keeps anyone out.** It ships to every visitor and is
 * reachable by anyone who types the URL; what it shows them is nothing, because
 * `database.rules.json` hands the `suggestions` node to one uid and Firebase is
 * what enforces that. A password compared in the bundle would have been a
 * decoration over a door that was already open — see ADR-0006.
 *
 * Accepting is deliberately **not** an action here. It writes a file into the
 * repo and ends in a commit, so the button copies the command and the terminal
 * does the rest. Rejecting is a real delete, and the only one in the app.
 */
const Admin = ({ access, signIn, signOut, reject }: AdminSeam) => {
  const [failed, setFailed] = useState(false);

  if (access.state === "signed-out") {
    return (
      <Card>
        <Stack spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Sign in to review the Suggestions players have sent.
          </Typography>
          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={() => {
              setFailed(false);
              signIn().catch(() => setFailed(true));
            }}
          >
            Sign in with Google
          </Button>
          {failed && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              That didn&apos;t sign you in. Try again.
            </Typography>
          )}
        </Stack>
      </Card>
    );
  }

  if (access.state === "checking") {
    return (
      <Card>
        <Stack spacing={2} alignItems="center">
          <Spinner />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Checking what this account may read…
          </Typography>
        </Stack>
      </Card>
    );
  }

  if (access.state === "denied") {
    return (
      <Card>
        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700 }}>
            This account can&apos;t read the Suggestions.
          </Typography>
          {/* The uid is printed because this is how the rule gets written in
              the first place: there is no way to know your own uid before
              signing in once, and the first sign-in is always denied. */}
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            To allow it, put this uid in <code>database.rules.json</code> and
            deploy with <code>firebase deploy --only database</code>:
          </Typography>
          <Box
            sx={{
              fontFamily: MONO,
              fontSize: "0.875rem",
              p: 1.5,
              borderRadius: 1,
              bgcolor: "action.hover",
              overflowWrap: "anywhere",
            }}
          >
            {access.user.uid}
          </Box>
          <Box>
            <Button variant="outlined" onClick={() => void signOut()}>
              Sign out
            </Button>
          </Box>
        </Stack>
      </Card>
    );
  }

  const { suggestions } = access;

  return (
    <Card>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {access.user.email ?? access.user.uid}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Stack>

      {suggestions.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", pt: 3 }}>
          Nothing waiting.
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, mt: 1, p: 0 }}>
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.key}
              suggestion={suggestion}
              onReject={() => void reject(suggestion.key)}
            />
          ))}
        </Box>
      )}
    </Card>
  );
};

/** The cream surface the queue stands on, cut out of the night. */
const Card = ({ children }: { children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ maxWidth: 560, mx: "auto", p: 2.5 }}>
    {children}
  </Paper>
);

export default Admin;
