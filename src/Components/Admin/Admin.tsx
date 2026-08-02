import { useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

import SuggestionRow from "../SuggestionRow/SuggestionRow";
import Spinner from "../Spinner/Spinner";
import { Admin as AdminSeam, SignInFailure } from "../../hooks/useAdmin";
import { SpotifyAuth } from "../../hooks/useSpotifyAuth";
import { MONO } from "../../theme";

interface AdminProps extends AdminSeam {
  /** The reviewer's Spotify session, which only accepting needs. */
  spotify: SpotifyAuth;
}

/**
 * The Suggestion review queue.
 *
 * **This screen is not what keeps anyone out.** It ships to every visitor and is
 * reachable by anyone who types the URL; what it shows them is nothing, because
 * `database.rules.json` hands the `suggestions` node to one uid and Firebase is
 * what enforces that. A password compared in the bundle would have been a
 * decoration over a door that was already open — see ADR-0006.
 *
 * Both decisions are real writes now (ADR-0008): rejecting deletes the
 * Suggestion, accepting writes the album and deletes the Suggestion in the same
 * update. Accepting additionally needs the reviewer's own Spotify account, for
 * the track list — which is what the strip below the header is for, and why it
 * explains itself rather than leaving a disabled button unexplained.
 */
const Admin = ({
  access,
  signIn,
  signOut,
  reject,
  accept,
  spotify,
}: AdminProps) => {
  const [failure, setFailure] = useState<SignInFailure | null>(null);

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
              setFailure(null);
              signIn().then((outcome) => {
                setFailure(outcome.ok || outcome.cancelled ? null : outcome);
              });
            }}
          >
            Sign in with Google
          </Button>
          {/* The code is printed for the same reason the denied state prints
              the uid: this is where the setup is found to be wrong, and
              "that didn't sign you in" describes every cause equally. */}
          {failure && (
            <Stack spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ color: "error.main" }}>
                {failure.code === "auth/unauthorized-domain"
                  ? `Firebase doesn't allow sign-in from ${window.location.hostname} — add it under Authentication → Settings → Authorized domains.`
                  : "That didn't sign you in. Try again."}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontFamily: MONO }}
              >
                {failure.code}
              </Typography>
            </Stack>
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
        <>
          <SpotifyStrip spotify={spotify} />
          <Box component="ul" sx={{ m: 0, mt: 1, p: 0 }}>
            {suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.key}
                suggestion={suggestion}
                onReject={() => void reject(suggestion.key)}
                canAccept={spotify.access.state === "connected"}
                onAccept={(liveFrom) =>
                  accept(suggestion, {
                    token:
                      spotify.access.state === "connected"
                        ? spotify.access.token
                        : "",
                    liveFrom,
                  })
                }
              />
            ))}
          </Box>
        </>
      )}
    </Card>
  );
};

/**
 * Whether this reviewer can accept, and what to do about it.
 *
 * It stands above the queue rather than inside each row because it is one fact
 * about the sitting, not about any Suggestion — and because a disabled Accept
 * button with nothing to explain it is the worst version of this. Shown only
 * when there is something to review: connecting Spotify to an empty queue is an
 * errand with no purpose.
 */
const SpotifyStrip = ({ spotify }: { spotify: SpotifyAuth }) => {
  const { access, connect, disconnect } = spotify;

  if (access.state === "connected") {
    return (
      <Strip>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Spotify connected — accepting will read each album&apos;s tracks.
        </Typography>
        <Button size="small" color="inherit" onClick={disconnect}>
          Disconnect
        </Button>
      </Strip>
    );
  }

  if (access.state === "connecting") {
    return (
      <Strip>
        <Spinner />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Waiting for the Spotify window…
        </Typography>
      </Strip>
    );
  }

  // A build with no client id cannot sign in to anything, so it says what the
  // way through is instead of offering a button that would do nothing.
  if (access.state === "unconfigured") {
    return (
      <Strip>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          This build has no Spotify client id, so accepting has to be done from
          the terminal. Each row can hand you the command.
        </Typography>
      </Strip>
    );
  }

  return (
    <Strip>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {access.state === "refused"
          ? access.reason
          : "Accepting reads the album's track list from Spotify."}
      </Typography>
      <Button size="small" variant="outlined" onClick={connect}>
        {access.state === "refused" ? "Try again" : "Connect Spotify"}
      </Button>
    </Strip>
  );
};

const Strip = ({ children }: { children: React.ReactNode }) => (
  <Stack
    direction="row"
    spacing={1.5}
    alignItems="center"
    justifyContent="space-between"
    useFlexGap
    flexWrap="wrap"
    sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
  >
    {children}
  </Stack>
);

/** The cream surface the queue stands on, cut out of the night. */
const Card = ({ children }: { children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ maxWidth: 560, mx: "auto", p: 2.5 }}>
    {children}
  </Paper>
);

export default Admin;
