import { describe, expect, mock, test } from "bun:test";
import { TILE_FORMAT_VERSION } from "@ev-maps/tiles";

// The tiles asked for, and the API's answer for each: full ones are a
// sample of a dense area. fetchJson is mocked, not the global fetch.
let asked;
let answer;
mock.module("@ev-maps/ui/fetch-json.js", () => ({
  fetchJson: async (url) => {
    const [, zoom, x, y] = /\/api\/chargers\/(\d+)\/(\d+)\/(\d+)/.exec(url).map(Number);
    asked.push({ url, zoom, x, y });
    return answer({ zoom, x, y });
  },
}));
const { fetchChargersInBounds } = await import("./chargers.js");

const fakeApi = (fullWhen) => {
  asked = [];
  answer = (tile) => ({
    chargers: [{ id: `${tile.zoom}/${tile.x}/${tile.y}` }, { id: "everywhere" }],
    full: fullWhen(tile),
  });
};

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
    asked = [];
    answer = () => {
      throw new Error("/api/chargers/… failed: 500");
    };
    await expect(fetchChargersInBounds(NEW_YORK)).rejects.toThrow("failed: 500");
  });
});
