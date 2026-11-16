// Loads EV chargers for the visible map area from the ev-maps API
// (/api/chargers/{z}/{x}/{y}, see packages/worker), which serves chargers from
// several sources, already merged and in the shape the app uses.
//
// The area is split into fixed Web Mercator tiles, so the same area always
// produces the same requests. A tile that's full is an arbitrary sample of a
// dense area, so it's split into its four smaller tiles, at most
// MAX_SPLIT_DEPTH times. The service worker (public/sw.js) caches tiles.

import { childTiles, clamp, intersects, tileBounds, tilesInBounds } from "@ev-maps/tiles";

// Tiles are 2 zoom levels larger than the map, so a viewport covers ~2×2 tiles.
const TILE_ZOOM_OFFSET = 2;
const MAX_TILE_ZOOM = 14;
const MAX_SPLIT_DEPTH = 2;

const inFlightRequests = new Map();

const tileUrl = ({ x, y, zoom }) => `/api/chargers/${zoom}/${x}/${y}`;

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Charger request failed: ${response.status}`);
  }
  return response.json();
};

// Shares one request between callers asking for the same URL at the same time.
const fetchJsonOnce = (url) => {
  if (!inFlightRequests.has(url)) {
    inFlightRequests.set(
      url,
      fetchJson(url).finally(() => inFlightRequests.delete(url))
    );
  }
  return inFlightRequests.get(url);
};

// Loads a tile; if it's full, loads its smaller tiles in view instead.
const fetchTileChargers = async ({ tile, bounds, depth = 0 }) => {
  const { chargers, full } = await fetchJsonOnce(tileUrl(tile));
  if (!full || depth >= MAX_SPLIT_DEPTH || tile.zoom >= MAX_TILE_ZOOM) {
    return { chargers, truncated: full };
  }
  const children = await Promise.all(
    childTiles(tile)
      .filter((child) => intersects(tileBounds(child), bounds))
      .map((child) => fetchTileChargers({ tile: child, bounds, depth: depth + 1 }))
  );
  return {
    chargers: children.flatMap((child) => child.chargers),
    truncated: children.some((child) => child.truncated),
  };
};

const fetchChargersInBounds = async ({ bounds, zoom }) => {
  const tileZoom = clamp(Math.floor(zoom) - TILE_ZOOM_OFFSET, 0, MAX_TILE_ZOOM);
  const tiles = await Promise.all(
    tilesInBounds(bounds, tileZoom).map((tile) => fetchTileChargers({ tile, bounds }))
  );
  const chargers = new Map();
  for (const charger of tiles.flatMap((tile) => tile.chargers)) {
    chargers.set(charger.id, charger);
  }
  return {
    chargers: [...chargers.values()],
    truncated: tiles.some((tile) => tile.truncated),
  };
};

export { fetchChargersInBounds };
