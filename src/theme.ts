import { createTheme } from "@mui/material/styles";

import { COLORS } from "./tokens";

// The system is defined in `design.md`; this is MUI's view of it. Colours come
// from `src/tokens.ts` and are never written literally here.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: COLORS.accent,
      dark: COLORS.accentDeep,
      // Pear is a light colour: its label is ink, not white. Left to itself MUI
      // would pick white here and the button would be unreadable.
      contrastText: COLORS.ink,
    },
    secondary: {
      main: COLORS.accent2,
      contrastText: COLORS.paper,
    },
    error: {
      main: COLORS.accent3Deep,
    },
    warning: {
      main: COLORS.accent3Deep,
    },
    success: {
      // The foreground-safe mint: MUI hands `success.main` to icons and text,
      // where the fill-weight mint is only 2.5:1 on cream. Surfaces that fill
      // with mint (the map) take `COLORS.mintDeep` from the tokens directly.
      main: COLORS.mintInk,
    },
    background: {
      default: COLORS.paper,
      paper: COLORS.paper,
    },
    text: {
      primary: COLORS.ink,
      secondary: COLORS.inkMuted,
    },
    divider: COLORS.rule,
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    // Display is confident rather than delicate, and tracks tight.
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      letterSpacing: "-0.025em",
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    // Mono keeps the one job it earns: figures that line up. Scores, distances
    // and country codes are tabular; running copy is not.
    overline: {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: COLORS.paper },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "1rem",
          padding: "10px 24px",
          borderRadius: 999,
        },
        // The press is the feedback: a solid colour edge underneath gives the
        // button its thickness, it lifts on hover, and it physically depresses
        // on click. The edge is flush to the button's width — a negative spread
        // would make it narrower than the button and read as a dropped shadow.
        containedPrimary: {
          boxShadow: `0 4px 0 0 ${COLORS.accentDeep}`,
          transform: "translateY(0)",
          transition:
            "transform 140ms cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 140ms cubic-bezier(0.2, 0.7, 0.3, 1), background-color 160ms",
          "&:hover": {
            boxShadow: `0 6px 0 0 ${COLORS.accentDeep}`,
            transform: "translateY(-2px)",
          },
          "&:active": {
            boxShadow: `0 1px 0 0 ${COLORS.accentDeep}`,
            transform: "translateY(3px)",
            transitionDuration: "70ms",
          },
          "&.Mui-disabled": {
            boxShadow: `0 4px 0 0 ${COLORS.accentDeep}`,
            transform: "none",
            opacity: 0.5,
          },
          // Spatial motion is the first thing to go; the press still recolours.
          "@media (prefers-reduced-motion: reduce)": {
            transition: "background-color 160ms",
            "&:hover, &:active": { transform: "none" },
          },
        },
        outlined: {
          borderWidth: 1.5,
          "&:hover": { borderWidth: 1.5, backgroundColor: COLORS.paper3 },
        },
        // The secondary action is drawn in ink, not in the accent: pear is the
        // colour of a *filled* button and only 1.4:1 as a label on cream.
        outlinedPrimary: {
          color: COLORS.ink,
          borderColor: COLORS.ink,
          "&:hover": { borderColor: COLORS.ink },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default theme;
