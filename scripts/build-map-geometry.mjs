#!/usr/bin/env node
// Generates the map interface's bundled country geometry (issue #2, ADR-0001).
//
// Inputs (devDependencies, build-time only — neither ships to the browser):
//   world-atlas/countries-50m.json  Natural Earth 1:50m country polygons,
//                                   TopoJSON, keyed by ISO 3166-1 *numeric*
//   world-countries                 ISO numeric -> alpha-2 lookup
//   src/countries.json              the app's guessable country set (alpha-2)
//
// Outputs (committed, imported by src/map/geography.ts):
//   src/map/countries-50m.topo.json  the same topology with each geometry's
//                                    `id` rewritten to the alpha-2 code the
//                                    app uses, so the runtime join is a plain
//                                    id lookup with no mapping table shipped
//   src/map/stragglers.json          alpha-2 codes of countries that need a
//                                    point-marker instead of a polygon
//
// Run: node scripts/build-map-geometry.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { geoArea } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// A country whose polygons cover less than this is a *straggler*: too small to
// hit reliably at world zoom, so it also gets a point-marker at its centroid.
// 15,000 km² is roughly 2px across on an 800px-wide world map — Cyprus and
// Jamaica are stragglers, Belgium and Israel (~4px) are not.
const STRAGGLER_MAX_AREA_KM2 = 15_000;

const EARTH_RADIUS_KM = 6371;
const STERADIAN_TO_KM2 = EARTH_RADIUS_KM ** 2;

// Territories Natural Earth carries without an ISO numeric id; anything not
// named here stays id-less and renders as non-interactive background land.
// Kosovo is a country the app can guess in its own right (`XK` in
// countries.json). Somaliland is not: the app follows the majority of world
// maps in drawing it as part of Somalia, so it is given Somalia's code and
// folded into that geometry by `mergeDuplicateIds` below.
const NAME_TO_ALPHA2 = { Kosovo: "XK", Somaliland: "SO" };

/** A geometry's polygons, in the nested-arc shape MultiPolygon uses. */
function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
}

// Natural Earth stores a few external territories as their own geometry under
// the parent country's ISO code (Australia + Ashmore and Cartier Islands).
// Fold those into one MultiPolygon per code, so a country is exactly one shape
// on the map — and so it carries exactly one clickable target and one label.
function mergeDuplicateIds(geometries) {
  const byId = new Map();
  const merged = [];

  for (const geometry of geometries) {
    const first = geometry.id === undefined ? undefined : byId.get(geometry.id);
    if (!first) {
      if (geometry.id !== undefined) byId.set(geometry.id, geometry);
      merged.push(geometry);
      continue;
    }
    first.arcs = [...polygonsOf(first), ...polygonsOf(geometry)];
    first.type = "MultiPolygon";
  }

  return merged;
}

function main() {
  const topology = require("world-atlas/countries-50m.json");
  const worldCountries = require("world-countries/countries.json");
  const countries = JSON.parse(
    readFileSync(join(repoRoot, "src/countries.json"), "utf8"),
  );

  const alpha2ByNumeric = new Map(
    worldCountries.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca2]),
  );

  // `land` is a second view over the same arcs; the map only draws countries.
  delete topology.objects.land;

  const geometries = topology.objects.countries.geometries;
  for (const geometry of geometries) {
    const alpha2 =
      alpha2ByNumeric.get(geometry.id) ??
      NAME_TO_ALPHA2[geometry.properties?.name];

    if (alpha2) {
      geometry.id = alpha2;
    } else {
      delete geometry.id;
    }
  }

  topology.objects.countries.geometries = mergeDuplicateIds(geometries);

  // Areas are measured on the joined topology so a code's area covers all of
  // its geometries, and only guessable codes are considered.
  const guessableCodes = new Set(countries.map((c) => c.code));
  const areaKm2ByCode = new Map();
  for (const f of feature(topology, topology.objects.countries).features) {
    if (f.id === undefined || !guessableCodes.has(f.id)) continue;
    const area = geoArea(f) * STERADIAN_TO_KM2;
    areaKm2ByCode.set(f.id, (areaKm2ByCode.get(f.id) ?? 0) + area);
  }

  const stragglers = countries
    .map((c) => c.code)
    .filter((code) => (areaKm2ByCode.get(code) ?? 0) < STRAGGLER_MAX_AREA_KM2)
    .sort();

  writeFileSync(
    join(repoRoot, "src/map/countries-50m.topo.json"),
    JSON.stringify(topology),
  );
  writeFileSync(
    join(repoRoot, "src/map/stragglers.json"),
    `${JSON.stringify(stragglers, null, 2)}\n`,
  );

  const withPolygon = countries.length - stragglers.length;
  console.log(`geometries: ${geometries.length}`);
  console.log(`countries with a polygon: ${withPolygon}/${countries.length}`);
  console.log(`stragglers (point-markers): ${stragglers.length}`);
  console.log(stragglers.join(" "));
}

main();
