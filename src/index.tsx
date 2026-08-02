import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";
import App from "./App";
import { completeSpotifyAuth } from "./spotify/callback";

// Before anything else: this document might not be the app at all, but the
// Spotify sign-in popup coming back to the redirect URI — which is the app's own
// address, because a registered redirect URI cannot carry a fragment. It answers
// its opener and closes; rendering a second GeoTracks inside it would be pure
// waste. Every ordinary load falls straight through. See ADR-0008.
if (!completeSpotifyAuth()) {
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement,
  );
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}
