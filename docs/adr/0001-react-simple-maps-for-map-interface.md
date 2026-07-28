# Render the map interface with react-simple-maps (SVG + bundled TopoJSON), not a tiled map

**Status:** accepted

For the clickable map interface (issue #2) we need discrete, per-country clickable/hoverable
shapes, a projection, and a surface to draw geo-hints on — not geographic browsing over street
or satellite imagery. We chose **react-simple-maps** (d3-geo + a bundled TopoJSON country set),
rendered as inline SVG with no external tile provider.

**Why, and the alternatives rejected:**
- **react-leaflet + GeoJSON** and **MapLibre/Mapbox GL** are built for slippy, tiled,
  pan-and-zoom map browsing. They bring a live tile-provider dependency (or a blank basemap that
  reinvents react-simple-maps with more weight) plus heavier bundles and config/lock-in — cost we
  don't need for a "click the right country" interaction.
- react-simple-maps gives per-country `onClick`/`onMouseEnter` essentially for free, stays fully
  **offline** (shapes bundled as a static asset — fits GitHub Pages hosting and the app's existing
  bundled-JSON pattern), and is compatible with the planned CRA→Vite migration.

**Consequences:** small-country clickability is handled with a hover tooltip plus react-simple-maps'
`ZoomableGroup` pan/zoom, rather than by adopting a tile engine. Country geometry now ships in the
bundle; its resolution is a separate decision (see later ADR / CONTEXT). We take on a d3-geo +
react-simple-maps dependency, which the pending Vite migration must keep working.
