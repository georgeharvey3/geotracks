/**
 * The mark's geometry, in one place.
 *
 * Kept apart from `Logo.tsx` because it is drawn twice: once by React, into the
 * chrome and the display lockup, and once by `scripts/build-logo-assets.ts`,
 * into `public/` as an SVG, two PNGs and a favicon. Two copies of a path string
 * is a mark that eventually stops matching its own favicon, so there is one.
 *
 * Plain TypeScript with no JSX *and no imports*, so the asset script can load it
 * under bare `node` — which strips types but resolves specifiers the way ESM
 * does, and would choke on this file's own imports before reaching a path. The
 * colours therefore stay out of here: `Logo.tsx` reads them from `tokens.ts` and
 * the script reads the same two from `tokens.css`, which exists to be the
 * portable export.
 */

/**
 * A square, and the mark is drawn to fill it rather than to sit in a safe area:
 * a pin is taller than it is wide, so its own width is what centres it.
 */
export const LOGO_VIEW_BOX = "0 0 64 64";

/**
 * The pin. Round head, point at the bottom, in the proportions a map pin is
 * read at — the head has to be big enough to hold the play glyph at 16px.
 */
export const PIN_PATH =
  "M32 3c-12.7 0-23 10.3-23 23 0 16.4 20.2 33.4 21.1 34.1a3 3 0 0 0 3.8 0C34.8 59.4 55 42.4 55 26 55 13.3 44.7 3 32 3z";

/**
 * The play triangle in the pin's head, centred on it (32, 26) and nudged right
 * by the half-degree a triangle needs to look centred rather than measured so.
 */
export const PLAY_PATH = "M26.5 16.5 43 26 26.5 35.5z";

/**
 * The ink line around the whole mark, in viewBox units.
 *
 * Load-bearing on cream, and for the same reason the map's marked countries
 * take one (`design.md` § The map): pear is 1.4:1 on paper, so the fill cannot
 * be what makes the shape visible — over the game screen's cream scrim the pin
 * would be a pale blob with no edge. On night it lands on near-black and simply
 * disappears, which is what it should do there.
 */
export const LOGO_STROKE = 3;

/** The line around the play glyph, which only rounds its corners. */
export const GLYPH_STROKE = 2;
