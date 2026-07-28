# Bundle Natural Earth 1:50m country geometry, joined to `countries.json` at build time

**Status:** accepted

ADR-0001 settled _how_ the map renders (react-simple-maps, inline SVG, no tile provider) and left
the geometry's resolution and packaging open. This records that decision, taken while building the
map interface (issue #2).

**The shapes:** Natural Earth **1:50m** country polygons, as shipped in the `world-atlas` TopoJSON
build. 1:110m is too coarse — whole countries the game can guess disappear or shrink below a
clickable size — and 1:10m is ~5x the bytes for detail no one can see at world zoom.

**The join:** Natural Earth keys countries by ISO 3166-1 _numeric_; the app keys everything by
alpha-2 (`src/countries.json`). Rather than ship a numeric→alpha-2 mapping to the browser,
`scripts/build-map-geometry.mjs` rewrites each geometry's `id` to the alpha-2 code at build time and
commits the result to `src/map/countries-50m.topo.json`. The runtime join
(`src/map/geography.ts`) is then a plain id lookup. The same script:

- folds Natural Earth's few duplicate-id geometries (a territory filed under its parent country's
  code) into one shape per country, so a country has exactly one target and one label;
- measures each country's area and writes the **stragglers** — countries under 15,000 km², roughly
  2px across at world zoom — to `src/map/stragglers.json`, which the map renders as clickable
  point-markers. This is what makes "every country in `countries.json` is committable" literally
  true rather than aspirational.

Regenerate with `node scripts/build-map-geometry.mjs` after changing `src/countries.json` or the
straggler threshold; `world-atlas`, `world-countries`, `topojson-client` and `d3-geo` are
devDependencies used only by that script.

**Consequences:** the geometry is a static import, so the map works offline, needs no fetch and no
loading state, and the tests exercise real shapes. The cost is bundle size: the topology adds
~740 kB raw (~230 kB gzipped) to the single JS chunk. Code-splitting it (a dynamic import for the
map, or moving the topology to a fetched static asset) is a worthwhile follow-up, and neither
choice would change the module boundaries this ADR sets up.
