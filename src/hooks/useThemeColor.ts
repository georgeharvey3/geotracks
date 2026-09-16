import { useEffect } from "react";

import { COLORS } from "../tokens";

/**
 * Keep `<meta name="theme-color">` on the ground the current screen stands on.
 *
 * Installed to a home screen the app has no browser chrome, so the status bar
 * sits directly on the page and the OS paints that strip with the theme colour.
 * One fixed value cannot serve this app: `design.md`'s two grounds mean the top
 * of a content page is the night backdrop and the top of a map surface is the
 * cream chrome scrim, so a single colour is wrong on half the screens — a cream
 * bar capping a near-black menu is exactly the seam that says "web page".
 *
 * It follows the *family*, not the screen, for the same reason everything else
 * about these two groups does: the caller already knows which family it is
 * rendering (`isMapSurface` in `App.tsx`), and a per-screen map here would be a
 * second place that decides what a screen is.
 *
 * Browser-side this is harmless and mildly nice — it tints Chrome's address bar
 * on Android the same way. Nothing reads it back, so there is no state here.
 */
export const useThemeColor = (onMapSurface: boolean): void => {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    // The tag is in `index.html`; if it is ever not, this is decoration and the
    // app should carry on without it rather than assert a head element exists.
    if (!meta) return;
    meta.setAttribute("content", onMapSurface ? COLORS.paper : COLORS.night);
  }, [onMapSurface]);
};

export default useThemeColor;
