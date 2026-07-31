import React, { useLayoutEffect, useRef } from "react";
import { Box, Container, IconButton, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";

import { COLORS } from "../../tokens";
import Logo from "../../Components/Logo/Logo";

interface BaseProps {
  showMenuButton: boolean;
  onMenuClicked: () => void;
  /**
   * Game-screen layout: the content owns the whole viewport (the map is the
   * surface) and the title/home button become chrome floating above it, rather
   * than sitting in a centred column that scrolls.
   */
  fullBleed?: boolean;
  /**
   * Decoration drawn behind the centred column, covering the viewport. The
   * content page is a column of type on the night the backdrop makes — this is
   * the ground it sits on, so it must be click-through and hidden from the
   * accessibility tree. Ignored in `fullBleed`, where the content already is
   * the surface.
   */
  backdrop?: React.ReactNode;
  /**
   * Which screen is showing. Nothing is read from it: it is the identity of the
   * thing being animated, so that arriving somewhere new replays the entrance
   * and a re-render of the same screen does not.
   */
  screenKey?: string;
  children: React.ReactNode;
}

// How long the wordmark takes to fly between the two places it lives. Long
// enough to be followed by eye — following it is the whole point, since it is
// what carries the player across an otherwise instant screen swap — and short
// enough not to hold up the screen it lands on.
const GLIDE_MS = 420;

/**
 * Where the wordmark last was on screen, across screen changes.
 *
 * The wordmark is the one element every screen shares, so it is what the
 * transition hangs on: rather than cutting from the menu's centred display size
 * to the game's chrome, the new one is drawn where the old one was and released
 * (FLIP). One module-level rect is enough because there is only ever one
 * wordmark, and the incoming one reads this before overwriting it.
 */
let lastWordmarkRect: DOMRect | null = null;

/**
 * Fly the wordmark from wherever it last was to where it is now.
 *
 * Mount-only: the screen key remounts it on every screen change, and measuring
 * again mid-flight would record the animated position rather than the settled
 * one. Everything here degrades to nothing rather than to something wrong — no
 * previous position, a zero-sized box (jsdom measures nothing) or no Web
 * Animations API and the wordmark simply appears where it belongs.
 */
const useWordmarkGlide = () => {
  const ref = useRef<HTMLSpanElement>(null);
  /**
   * Where this wordmark flies *from*, held for as long as it is mounted.
   *
   * StrictMode runs a layout effect twice on mount — run, clean up, run again —
   * and the cleanup cancels the flight. Reading the module-level rect a second
   * time would measure the destination the first run had already recorded,
   * against itself: no distance, no replay, and a glide that is requested and
   * cancelled within a frame. Holding the origin here means the second run
   * repeats the same flight instead of finding none to make.
   *
   * `undefined` is "not yet captured"; `null` is "nothing to fly from", which
   * is the first screen of the session.
   */
  const originRef = useRef<DOMRect | null | undefined>(undefined);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (originRef.current === undefined) originRef.current = lastWordmarkRect;
    const from = originRef.current;
    const to = node.getBoundingClientRect();
    lastWordmarkRect = to;

    if (!from || from.width === 0 || to.width === 0) return;
    if (typeof node.animate !== "function") return;
    // The one piece of motion in the app that CSS's global reduced-motion rule
    // cannot reach, and it is pure spatial motion — so it asks for itself.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const scale = from.width / to.width;
    // The two content pages put it in the same place; there is nothing to fly.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) {
      return;
    }

    const animation = node.animate(
      [
        // The origin is the top-left corner both measurements are taken from,
        // so translating then scaling about it lands the new box exactly on the
        // old one — no drift for the eye to catch.
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: "none" },
      ],
      {
        duration: GLIDE_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        composite: "replace",
      },
    );

    return () => animation.cancel();
  }, []);

  return ref;
};

/**
 * The mark and the word, as one lockup.
 *
 * The word's emphasis sits on the seam of the compound it is made of — `Geo`
 * light and muted, `Tracks` at the display weight — rather than on a letter
 * picked out in colour. A coloured letter is emphasis without an argument:
 * nothing about the word says why that letter and not its neighbour. Weight
 * says which half of the name you are reading, and it leaves colour out of the
 * type altogether, so coral is free to stay the one loud moment on a screen and
 * the mark is what carries the brand.
 */
const Wordmark = ({
  fontSize,
  onNight,
}: {
  fontSize?: string;
  onNight?: boolean;
}) => {
  const glideRef = useWordmarkGlide();

  return (
    <Typography
      variant="h1"
      // Splitting the word into elements to weight one half also splits it for
      // the accessibility tree, which announces "Geo Tracks". The label puts the
      // word back together: how it is read shouldn't follow how it is painted.
      aria-label="GeoTracks"
      sx={{ fontSize, py: fontSize ? 0 : 1 }}
    >
      {/* The glide measures the *lockup*, not the block it is laid out in: the
          heading fills its container on both screens, so its own box would put
          the two at the same width and the flight would never scale. The mark
          is inside it, and sized in `em`, so the whole thing flies as one
          rather than the word gliding while the mark cuts. */}
      <Box
        component="span"
        ref={glideRef}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.24em",
        }}
      >
        <Logo />
        <Box component="span">
          <Box
            component="span"
            sx={{
              fontWeight: 400,
              color: onNight ? COLORS.paperMuted : COLORS.inkMuted,
            }}
          >
            Geo
          </Box>
          Tracks
        </Box>
      </Box>
    </Typography>
  );
};

const HomeButton = ({
  onClick,
  onNight,
}: {
  onClick: () => void;
  onNight?: boolean;
}) => (
  <IconButton
    onClick={onClick}
    aria-label="Back to menu"
    sx={{
      color: onNight ? COLORS.paperMuted : "text.secondary",
      "&:hover": { color: onNight ? COLORS.paper : "text.primary" },
    }}
  >
    <HomeIcon />
  </IconButton>
);

/**
 * Chrome for the full-bleed layout. The row itself is click-through so the map
 * underneath stays draggable; only the button takes pointer events. A scrim
 * keeps the wordmark legible over whatever the map draws beneath it.
 */
const OverlayChrome = (props: {
  showMenuButton: boolean;
  onMenuClicked: () => void;
  screenKey?: string;
}) => (
  <Box
    sx={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      px: 1,
      pt: 0.5,
      pb: 3,
      display: "flex",
      alignItems: "center",
      gap: 1,
      pointerEvents: "none",
      // A cream scrim now, matching the paper the rest of the app is on: the
      // chrome has to stay legible over sea, land and every mark alike.
      background:
        "linear-gradient(to bottom, rgba(247, 245, 236, 0.92) 0%, rgba(247, 245, 236, 0) 100%)",
    }}
  >
    <Box sx={{ pointerEvents: "auto", minWidth: 40 }}>
      {props.showMenuButton && <HomeButton onClick={props.onMenuClicked} />}
    </Box>
    <Wordmark key={props.screenKey} fontSize="1.5rem" />
  </Box>
);

/**
 * The layout every screen is dressed in: a centred column on the night backdrop
 * for the content pages, and the viewport itself for the surfaces made of the
 * map.
 *
 * The chrome — the wordmark and the home button — deliberately sits *outside*
 * what enters. Only the content of a screen fades in; the wordmark is the one
 * thing both screens have, so it flies between its two places (`useWordmarkGlide`)
 * rather than fading with everything else, and fading it would hide the flight
 * behind exactly the cut it exists to cover.
 */
const Base = (props: BaseProps) => {
  if (props.fullBleed) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {/* No fade here, unlike the content pages: the map surfaces enter by
            the night coming off the map (`veil="lift"`, see `BaseMap`). Fading
            a map up means drawing it at less than full opacity over the cream
            underneath, which the player sees as the whole screen washing out to
            white before it arrives — and the map is the one thing on these
            screens that was already there to be revealed. Still keyed, so what
            does animate restarts on arrival rather than on every render. */}
        <Box key={props.screenKey} sx={{ position: "absolute", inset: 0 }}>
          {props.children}
        </Box>
        <OverlayChrome
          showMenuButton={props.showMenuButton}
          onMenuClicked={props.onMenuClicked}
          screenKey={props.screenKey}
        />
      </Box>
    );
  }

  return (
    <>
      {/* Outside the column: the ground does not re-enter when the page
          standing on it changes. */}
      {props.backdrop}
      <Container
        maxWidth="sm"
        // The content pages stand on the night backdrop, so their chrome is
        // drawn in paper rather than ink. Opaque surfaces inside them — the
        // scoreboard's own card — are MUI `Paper` and reset to ink themselves.
        data-surface="night"
        sx={{
          textAlign: "center",
          color: COLORS.paper,
          // Above the backdrop, which is fixed at z-index 0: the column paints
          // over it rather than being tinted by it.
          position: "relative",
          zIndex: 1,
          py: 2,
          px: 2,
        }}
      >
        <Box sx={{ position: "relative", mb: 1 }}>
          {props.showMenuButton && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <HomeButton onClick={props.onMenuClicked} onNight />
            </Box>
          )}
          <Wordmark key={props.screenKey} onNight />
        </Box>
        <Box key={props.screenKey} className="screen-enter">
          {props.children}
        </Box>
      </Container>
    </>
  );
};

export default Base;
