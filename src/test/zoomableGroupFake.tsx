import { ReactNode, useEffect } from "react";
import { act } from "@testing-library/react";

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
 *
 * The real wrapper reports the zoom level through `onMove`; the fake hands that
 * callback to `zoomTo()` so a test can drive the zoom without d3.
 */

let reportMove: ((position: { zoom: number }) => void) | undefined;

/** Report a zoom level to the map under test, as a real pan/zoom gesture would. */
export const zoomTo = (zoom: number) => {
  act(() => reportMove?.({ zoom }));
};

interface ZoomableGroupFakeProps {
  children?: ReactNode;
  translateExtent?: [[number, number], [number, number]];
  onMove?: (position: { zoom: number }) => void;
}

const ZoomableGroupFake = ({
  children,
  translateExtent,
  onMove,
}: ZoomableGroupFakeProps) => {
  useEffect(() => {
    reportMove = onMove;
    return () => {
      reportMove = undefined;
    };
  }, [onMove]);

  // d3-zoom enforces the pan bounds for real, so the fake can only report what
  // it was handed; a test asserts the map hands it the world's own box.
  return (
    <g
      data-testid="zoomable-group"
      data-translate-extent={translateExtent && JSON.stringify(translateExtent)}
    >
      {children}
    </g>
  );
};

export default ZoomableGroupFake;
