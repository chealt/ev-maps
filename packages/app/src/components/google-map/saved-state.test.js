import { beforeEach, describe, expect, mock, test } from "bun:test";

// IndexedDB through idb-keyval, and localStorage: both in memory.
const stored = new Map();
mock.module("idb-keyval", () => ({
  get: async (key) => stored.get(key),
  set: async (key, value) => {
    stored.set(key, value);
  },
}));
const legacy = new Map();
globalThis.localStorage = {
  getItem: (key) => legacy.get(key) ?? null,
  setItem: (key, value) => legacy.set(key, String(value)),
  removeItem: (key) => legacy.delete(key),
};

const { readMapView, saveMapView } = await import("./saved-state.js");

beforeEach(() => {
  stored.clear();
  legacy.clear();
});

describe("readMapView", () => {
  test("the view saved last", async () => {
    await saveMapView({ center: { lat: 51.5074, lng: -0.1278 }, zoom: 13 });
    expect(await readMapView()).toEqual({ center: { lat: 51.5074, lng: -0.1278 }, zoom: 13 });
  });

  test("an older version's Locate Me position, once, at no zoom of its own", async () => {
    legacy.set("ev-maps:last-location", JSON.stringify({ lat: 47.4979, lng: 19.0402 }));
    expect(await readMapView()).toEqual({ center: { lat: 47.4979, lng: 19.0402 }, zoom: null });
    expect(legacy.has("ev-maps:last-location")).toBe(false);
    expect(await readMapView()).toBeNull();
  });

  test("nothing, when what's saved isn't a view", async () => {
    stored.set("ev-maps:map-view", { center: { lat: "x" }, zoom: 3 });
    legacy.set("ev-maps:last-location", "not json");
    expect(await readMapView()).toBeNull();
  });
});
