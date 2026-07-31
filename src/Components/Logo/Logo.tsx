import { Box } from "@mui/material";

import { COLORS } from "../../tokens";
import {
  GLYPH_STROKE,
  LOGO_STROKE,
  LOGO_VIEW_BOX,
  PIN_PATH,
  PLAY_PATH,
} from "./geometry";

interface LogoProps {
  /**
   * How tall the mark is, as a multiple of the font size beside it. Sizing in
   * `em` rather than pixels is what lets one lockup serve both places it
   * appears: the wordmark's flight between screens is a scale, and a mark
   * measured in px would be the one part of it that didn't scale.
   */
  height?: string;
}

/**
 * The mark: a map pin whose head is a play button — where the music is from,
 * and that you can hear it, in one shape.
 *
 * Pear fills it and ink draws the glyph, which is the system's rule about
 * accents and foregrounds rather than a choice made here.
 *
 * Always drawn beside the wordmark, which already carries the name, so it is
 * hidden from the accessibility tree: announcing it too would read the app's
 * name twice on every screen.
 */
const Logo = ({ height = "1.18em" }: LogoProps) => (
  <Box
    component="svg"
    viewBox={LOGO_VIEW_BOX}
    aria-hidden
    focusable="false"
    sx={{
      height,
      // A pin is taller than it is wide; the square viewBox keeps the two in
      // step so the lockup's spacing doesn't change with the type size.
      width: height,
      display: "block",
      flexShrink: 0,
    }}
  >
    <path
      d={PIN_PATH}
      fill={COLORS.accent}
      stroke={COLORS.ink}
      strokeWidth={LOGO_STROKE}
      strokeLinejoin="round"
    />
    <path
      d={PLAY_PATH}
      fill={COLORS.ink}
      stroke={COLORS.ink}
      strokeWidth={GLYPH_STROKE}
      strokeLinejoin="round"
    />
  </Box>
);

export default Logo;
