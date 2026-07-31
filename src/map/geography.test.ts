import { describe, it, expect } from "vitest";
import countriesJSON from "../countries.json";
import {
  countryCodeByName,
  countryNameByCode,
  polygonCodes,
  stragglerMarkers,
  topology,
} from "./geography";

describe("map geography", () => {
  it("makes every guessable country committable — as a polygon or a point-marker", () => {
    const markerCodes = new Set(stragglerMarkers.map((m) => m.code));
    const unreachable = countriesJSON.filter(
      (country) =>
        !polygonCodes.has(country.code) && !markerCodes.has(country.code),
    );

    expect(unreachable).toEqual([]);
  });

  it("gives every straggler a marker at its countries.json centroid", () => {
    for (const marker of stragglerMarkers) {
      const country = countriesJSON.find((c) => c.code === marker.code)!;
      expect(country).toBeDefined();
      expect(marker.name).toBe(country.name);
      expect(marker.coordinates).toEqual([
        parseFloat(country.lon),
        parseFloat(country.lat),
      ]);
      // A marker at NaN renders nowhere and can't be clicked, so an unusable
      // centroid must fail here rather than pass as a placed marker.
      expect(marker.coordinates.every(Number.isFinite)).toBe(true);
    }
  });

  it("resolves codes to names and back, ignoring case", () => {
    expect(countryNameByCode("FR")).toBe("France");
    expect(countryCodeByName("France")).toBe("FR");
    expect(countryCodeByName("fRaNcE")).toBe("FR");
    expect(countryCodeByName("Atlantis")).toBeUndefined();
    expect(countryNameByCode("ZZ")).toBeUndefined();
  });

  it("only treats codes the app can guess as polygons", () => {
    // Natural Earth carries shapes the app has no country for (e.g. Åland,
    // Curaçao). They still render, but they are not committable.
    const geometryIds = topology.objects.countries.geometries
      .map((geometry) => geometry.id)
      .filter((id): id is string => id !== undefined);

    expect(geometryIds).toContain("AX");
    expect(polygonCodes.has("AX")).toBe(false);
  });

  it("draws Somaliland as part of Somalia, and South Sudan as its own country", () => {
    // Somaliland is unrecognised and has no ISO code; the app follows most
    // world maps in folding it into Somalia's shape rather than leaving it as
    // an unguessable hole in the Horn of Africa. South Sudan has both, so it
    // is a country here like any other.
    const somalia = topology.objects.countries.geometries.filter(
      (geometry) => geometry.id === "SO",
    );

    expect(somalia).toHaveLength(1);
    expect(
      topology.objects.countries.geometries.some(
        (geometry) => geometry.properties?.name === "Somaliland",
      ),
    ).toBe(false);

    expect(polygonCodes.has("SS")).toBe(true);
    expect(countryNameByCode("SS")).toBe("South Sudan");
  });
});
