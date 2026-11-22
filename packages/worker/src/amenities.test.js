import { describe, expect, test } from "bun:test";
import { amenitiesQuery, amenityIds, amenityMasks, parsePlaces } from "./amenities.js";

// Meters to degrees of latitude, and of longitude at latitude 47.
const north = (meters) => meters / 111320;
const east = (meters) => meters / (111320 * Math.cos((47 * Math.PI) / 180));

describe("amenitiesQuery", () => {
  test("asks for each kind's centers, separated by counts, around the cell", () => {
    const query = amenitiesQuery({ south: 47, west: 19, north: 48, east: 20 });
    expect(query.match(/out skel center qt;out count;/g)).toHaveLength(4);
    expect(query).toContain('nwr["amenity"="cafe"](46.99865,18.99799,48.00135,20.00201)');
    expect(query).toContain('nwr["leisure"="playground"]');
  });
});

describe("parsePlaces", () => {
  test("tells the kinds apart by the counts between them", () => {
    const places = parsePlaces([
      { type: "node", lat: 1, lon: 2 },
      { type: "count" },
      { type: "way", center: { lat: 3, lon: 4 } },
      { type: "count" },
      { type: "count" },
      { type: "node", lat: 5, lon: 6 },
      { type: "count" },
    ]);
    expect(places).toEqual([
      { bit: 1, lat: 1, lng: 2 },
      { bit: 2, lat: 3, lng: 4 },
      { bit: 8, lat: 5, lng: 6 },
    ]);
  });
});

describe("amenityMasks", () => {
  test("marks the kinds within 150 m of each charger", () => {
    const charger = { lat: 47.5, lng: 19.05 };
    const far = { lat: 47.6, lng: 19.05 };
    const places = [
      { bit: 1, lat: 47.5 + north(100), lng: 19.05 },
      { bit: 2, lat: 47.5, lng: 19.05 + east(140) },
      { bit: 4, lat: 47.5 + north(160), lng: 19.05 },
      { bit: 8, lat: 47.5 + north(120), lng: 19.05 + east(120) },
    ];
    expect(amenityMasks([charger, far], places, 47.5)).toEqual([3, 0]);
  });
});

describe("amenityIds", () => {
  test("names the kinds in a mask", () => {
    expect(amenityIds(5)).toEqual(["coffee", "restaurant"]);
    expect(amenityIds(0)).toEqual([]);
  });
});
