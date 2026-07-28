import { ReactNode } from "react";

/**
 * Stand-in for react-simple-maps' `<ZoomableGroup>`, which drives pan/zoom with
 * d3-zoom. d3-zoom dereferences `event.view.document` on mousedown and jsdom's
 * synthetic events carry no `view`, so any click on the map would blow up inside
 * d3. Tests swap the wrapper for a plain `<g>`; the rest of the map — the
 * projection, the geographies, the markers — is the real library.
 *
 * Use it with:
 *
 *   vi.mock("react-simple-maps", async (importOriginal) => ({
 *     ...(await importOriginal<typeof import("react-simple-maps")>()),
 *     ZoomableGroup: (await import("./test/zoomableGroupFake")).default,
 *   }));
 */
const ZoomableGroupFake = ({ children }: { children?: ReactNode }) => (
  <g data-testid="zoomable-group">{children}</g>
);

export default ZoomableGroupFake;
