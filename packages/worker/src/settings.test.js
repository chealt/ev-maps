import { describe, expect, test } from "bun:test";
import { mergeSettings, validSection } from "./settings.js";

describe("validSection", () => {
  test("accepts filters in the right shape", () => {
    expect(
      validSection("filters", {
        powerRanges: ["150-300"],
        connectorTypes: ["ccs", "chademo"],
        updatedAt: 1,
      })
    ).toBe(true);
  });

  test("accepts the operators turned off, including unknown ones and long names", () => {
    const longName = "Société d'Économie Mixte des Énergies Renouvelables de la Région";
    expect(
      validSection("filters", { excludedOperators: ["", "Ionity", longName], updatedAt: 1 })
    ).toBe(true);
    expect(validSection("filters", { excludedOperators: ["x".repeat(121)], updatedAt: 1 })).toBe(
      false
    );
    expect(
      validSection("filters", { excludedOperators: Array(201).fill("Ionity"), updatedAt: 1 })
    ).toBe(false);
  });

  test("accepts showing only favorites, as a boolean", () => {
    expect(validSection("filters", { onlyFavorites: true, updatedAt: 1 })).toBe(true);
    expect(validSection("filters", { onlyFavorites: "yes", updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { hideUnavailable: true, updatedAt: 1 })).toBe(true);
    expect(validSection("filters", { hideUnavailable: 1, updatedAt: 1 })).toBe(false);
  });

  test("refuses unknown sections and fields, wrong types and missing times", () => {
    expect(validSection("favourites", { updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: [], extra: 1, updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: "150-300", updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: [] })).toBe(false);
    expect(validSection("filters", null)).toBe(false);
  });
});

describe("mergeSettings", () => {
  test("keeps the newer copy of each section", () => {
    const stored = { filters: { powerRanges: ["300-plus"], updatedAt: 200 } };

    expect(
      mergeSettings(stored, { filters: { powerRanges: ["under-50"], updatedAt: 100 } })
    ).toEqual(stored);
    expect(
      mergeSettings(stored, { filters: { powerRanges: ["under-50"], updatedAt: 300 } })
    ).toEqual({ filters: { powerRanges: ["under-50"], updatedAt: 300 } });
  });

  test("adds sections the account doesn't have yet", () => {
    expect(mergeSettings({}, { filters: { powerRanges: [], updatedAt: 1 } })).toEqual({
      filters: { powerRanges: [], updatedAt: 1 },
    });
  });
});

describe("routeHistory", () => {
  const route = {
    origin: { label: "Budapest, Hungary", placeId: "budapest" },
    destination: { label: "My location", location: { lat: 48.2, lng: 16.37 } },
    filters: { powerRanges: ["150-300"], onlyFavorites: false },
    plannedAt: 1,
  };

  test("takes up to 10 routes with their places and filters", () => {
    expect(validSection("routeHistory", { routes: [route], updatedAt: 1 })).toBe(true);
    expect(validSection("routeHistory", { routes: [], updatedAt: 1 })).toBe(true);
    expect(
      validSection("routeHistory", {
        routes: Array.from({ length: 11 }, () => route),
        updatedAt: 1,
      })
    ).toBe(false);
  });

  test("turns down routes without places or with unknown filters", () => {
    const without = (changes) =>
      validSection("routeHistory", { routes: [{ ...route, ...changes }], updatedAt: 1 });
    expect(without({ origin: { label: "Nowhere" } })).toBe(false);
    expect(without({ destination: { label: "x", location: { lat: 99, lng: 0 } } })).toBe(false);
    expect(without({ filters: { colour: "red" } })).toBe(false);
    expect(without({ plannedAt: "yesterday" })).toBe(false);
  });
});

describe("mapsApp", () => {
  test("takes one of the maps apps, or null to ask every time", () => {
    for (const app of ["google", "osm", "apple", null]) {
      expect(validSection("mapsApp", { app, updatedAt: 1 })).toBe(true);
    }
  });

  test("turns down other apps and values", () => {
    for (const app of ["waze", "", 1, undefined, ["google"]]) {
      expect(validSection("mapsApp", { app, updatedAt: 1 })).toBe(false);
    }
    expect(validSection("mapsApp", { app: "google" })).toBe(false);
  });
});

describe("favoriteRoutes", () => {
  const route = {
    origin: { label: "Budapest, Hungary", placeId: "budapest" },
    destination: { label: "Vienna, Austria", placeId: "vienna" },
    filters: { connectorTypes: ["ccs"] },
    plannedAt: 1,
  };

  test("takes up to 20 routes, as the history has them", () => {
    expect(validSection("favoriteRoutes", { routes: [route], updatedAt: 1 })).toBe(true);
    expect(validSection("favoriteRoutes", { routes: [], updatedAt: 1 })).toBe(true);
    expect(
      validSection("favoriteRoutes", {
        routes: Array.from({ length: 21 }, () => route),
        updatedAt: 1,
      })
    ).toBe(false);
  });

  test("turns down routes the history would", () => {
    expect(
      validSection("favoriteRoutes", {
        routes: [{ ...route, origin: { label: "Nowhere" } }],
        updatedAt: 1,
      })
    ).toBe(false);
  });
});
