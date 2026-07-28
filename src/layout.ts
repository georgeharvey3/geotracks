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
