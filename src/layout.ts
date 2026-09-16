/**
 * Shared geometry for the game screen's two-layer layout (map + control panel).
 *
 * An Equal Earth world is roughly 2:1, which drives the whole split:
 *
 *   Landscape — the viewport is close enough to the world's own shape that the
 *     map can cover it edge to edge, and the panel floats over one corner.
 *   Portrait — a full-width world is only half the viewport wide in height, so
 *     covering would crop away most of its width. The two stack instead: the
 *     panel is a tray at the bottom sized to its own content, and the map takes
 *     every pixel it leaves.
 */
export const LANDSCAPE_QUERY = "(min-aspect-ratio: 13/10)";

/** The same breakpoint as an `sx` key. */
export const LANDSCAPE_MEDIA = `@media ${LANDSCAPE_QUERY}`;

/** Vertical space the overlay chrome (home button + title) needs left clear. */
export const CHROME_CLEARANCE = 56;

/**
 * Portrait ceiling on the tray. The tray is content-sized, and collapsed it
 * stays well under this; the cap only bites when the player expands the guess
 * board, and it guarantees the map keeps a usable band of the screen.
 */
export const PORTRAIT_PANEL_MAX_HEIGHT = "72%";

/**
 * The parts of the viewport an iPhone keeps for itself.
 *
 * Installed to a home screen the app is drawn edge to edge — `viewport-fit=cover`
 * in `index.html` is what asks for that — which means the notch or Dynamic
 * Island overlaps the top of the screen, the home indicator overlaps the bottom,
 * and in landscape one whole side is behind the camera housing. The map wants
 * exactly that: it is the ground, and ground should reach the edges. Everything
 * *placed on* the map does not, so each piece of floating chrome adds the inset
 * on the edge it is pinned to.
 *
 * `env()` resolves to 0 wherever there is nothing to avoid — every desktop
 * browser, and any iOS that insets the web view itself instead — so these are
 * additive rather than a branch, and the layout is unchanged everywhere else.
 * The fallback argument matters: an engine that has never heard of `env()` drops
 * the whole declaration, and `calc(24px + 0px)` is the value we wanted anyway.
 *
 * @param edge  which inset to read
 * @param base  the spacing the design already wanted there, in px
 */
export const safeArea = (
  edge: "top" | "right" | "bottom" | "left",
  base: number,
): string => `calc(${base}px + env(safe-area-inset-${edge}, 0px))`;
