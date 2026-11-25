import { afterEach, describe, expect, test } from "bun:test";
import { TILE_FORMAT_VERSION } from "@ev-maps/tiles";
import { fetchChargersInBounds } from "./chargers.js";

// The tiles asked for, and the API's answer for each: full ones are a
// sample of a dense area.
const realFetch = globalThis.fetch;
let asked;
const fakeApi = (fullWhen) => {
  asked = [];
  globalThis.fetch = async (url) => {
    const [, zoom, x, y] = /\/api\/chargers\/(\d+)\/(\d+)\/(\d+)/.exec(url).map(Number);
    asked.push({ url, zoom, x, y });
    const tile = { zoom, x, y };
    return Response.json({
      chargers: [{ id: `${zoom}/${x}/${y}` }, { id: "everywhere" }],
      full: fullWhen(tile),
    });
  };
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

const NEW_YORK = {
  bounds: { south: 40.65, west: -74.1, north: 40.78, east: -73.9 },
  zoom: 12,
};

describe("fetchChargersInBounds", () => {
  test("asks for the tiles in view, two zooms out, in the current format, once each", async () => {
    fakeApi(() => false);
    const { chargers, truncated } = await fetchChargersInBounds(NEW_YORK);
    expect(asked.every(({ zoom }) => zoom === 10)).toBe(true);
    expect(asked.every(({ url }) => url.endsWith(`?v=${TILE_FORMAT_VERSION}`))).toBe(true);
    expect(new Set(asked.map(({ url }) => url)).size).toBe(asked.length);
    // A charger in several tiles is listed once.
    expect(chargers.filter(({ id }) => id === "everywhere")).toHaveLength(1);
    expect(truncated).toBe(false);
  });

  test("loads a full tile's smaller tiles instead, at most twice over", async () => {
    fakeApi(({ zoom }) => zoom < 12);
    const { chargers, truncated } = await fetchChargersInBounds(NEW_YORK);
    expect(Math.max(...asked.map(({ zoom }) => zoom))).toBe(12);
    // The chargers come from the smallest tiles, which weren't full.
    expect(chargers.some(({ id }) => id.startsWith("12/"))).toBe(true);
    expect(chargers.some(({ id }) => id.startsWith("10/"))).toBe(false);
    expect(truncated).toBe(false);
  });

  test("says it's truncated when even the smallest tiles are full", async () => {
    fakeApi(() => true);
    const { truncated } = await fetchChargersInBounds(NEW_YORK);
    expect(Math.max(...asked.map(({ zoom }) => zoom))).toBe(12);
    expect(truncated).toBe(true);
  });

  test("fails when a tile can't be loaded", async () => {
    globalThis.fetch = async () => new Response("", { status: 500 });
    await expect(fetchChargersInBounds(NEW_YORK)).rejects.toThrow("Charger request failed: 500");
  });
});
