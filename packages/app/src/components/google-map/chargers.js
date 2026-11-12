// Loads EV chargers from Open Charge Map (https://openchargemap.org).
//
// The visible map area is split into fixed Web Mercator tiles, so the same
// area always produces the same requests. Each tile's response is kept in
// Cache Storage for a day, so panning back or reloading doesn't hit the API.

const API_URL = "https://api.openchargemap.io/v3/poi";
const CACHE_NAME = "ev-maps-open-charge-map-v1";
const CACHED_AT_HEADER = "x-ev-maps-cached-at";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS_PER_TILE = 500;
// Tiles are 2 zoom levels larger than the map, so a viewport covers ~2×2 tiles.
const TILE_ZOOM_OFFSET = 2;
const MAX_TILE_ZOOM = 14;

const inFlightTiles = new Map();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lngToTileX = (lng, zoom) => Math.floor(((lng + 180) / 360) * 2 ** zoom);

const latToTileY = (lat, zoom) => {
  const radians = (clamp(lat, -85.0511, 85.0511) * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom
  );
};

const tileXToLng = (x, zoom) => (x / 2 ** zoom) * 360 - 180;

const tileYToLat = (y, zoom) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))) * 180) / Math.PI;

const tilesInBounds = ({ north, south, east, west }, zoom) => {
  const lastTile = 2 ** zoom - 1;
  const minX = clamp(lngToTileX(west, zoom), 0, lastTile);
  const maxX = clamp(lngToTileX(east, zoom), 0, lastTile);
  const minY = clamp(latToTileY(north, zoom), 0, lastTile);
  const maxY = clamp(latToTileY(south, zoom), 0, lastTile);
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y, zoom });
    }
  }
  return tiles;
};

const tileUrl = ({ x, y, zoom }, apiKey) => {
  const north = tileYToLat(y, zoom);
  const south = tileYToLat(y + 1, zoom);
  const west = tileXToLng(x, zoom);
  const east = tileXToLng(x + 1, zoom);
  const params = new URLSearchParams({
    output: "json",
    boundingbox: `(${south},${west}),(${north},${east})`,
    maxresults: String(MAX_RESULTS_PER_TILE),
    verbose: "false",
    key: apiKey,
  });
  return `${API_URL}?${params}`;
};

const openCache = async () => {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    // Cache Storage is unavailable (e.g. not a secure context).
    return null;
  }
};

const isFresh = (response) =>
  Date.now() - Number(response.headers.get(CACHED_AT_HEADER)) < CACHE_MAX_AGE_MS;

const fetchTileFromApi = async (url, cache) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Charge Map request failed: ${response.status}`);
  }
  const body = await response.text();
  await cache?.put(
    url,
    new Response(body, {
      headers: { "content-type": "application/json", [CACHED_AT_HEADER]: String(Date.now()) },
    })
  );
  return JSON.parse(body);
};

const fetchTile = async (url) => {
  const cache = await openCache();
  const cached = await cache?.match(url);
  if (cached && isFresh(cached)) {
    return cached.json();
  }
  return fetchTileFromApi(url, cache);
};

const fetchTileOnce = (url) => {
  if (!inFlightTiles.has(url)) {
    inFlightTiles.set(
      url,
      fetchTile(url).finally(() => inFlightTiles.delete(url))
    );
  }
  return inFlightTiles.get(url);
};

const deleteExpiredTiles = async () => {
  const cache = await openCache();
  for (const request of (await cache?.keys()) ?? []) {
    const response = await cache.match(request);
    if (response && !isFresh(response)) {
      await cache.delete(request);
    }
  }
};

const toCharger = (poi) => ({
  id: poi.ID,
  name: poi.AddressInfo?.Title || "EV charger",
  location: { lat: poi.AddressInfo?.Latitude, lng: poi.AddressInfo?.Longitude },
  address: [
    poi.AddressInfo?.AddressLine1,
    poi.AddressInfo?.Town,
    poi.AddressInfo?.StateOrProvince,
    poi.AddressInfo?.Postcode,
  ]
    .filter(Boolean)
    .join(", "),
  operator: poi.OperatorInfo?.Title,
  usageType: poi.UsageType?.Title,
  usageCost: poi.UsageCost,
  status: poi.StatusType?.Title,
  numberOfPoints: poi.NumberOfPoints,
  connectors: (poi.Connections ?? []).map((connection) => ({
    type: connection.ConnectionType?.Title || "Unknown connector",
    powerKw: connection.PowerKW,
    quantity: connection.Quantity,
  })),
});

const hasLocation = ({ location }) =>
  Number.isFinite(location.lat) && Number.isFinite(location.lng);

const fetchChargersInBounds = async ({ bounds, zoom, apiKey }) => {
  const tileZoom = clamp(Math.floor(zoom) - TILE_ZOOM_OFFSET, 0, MAX_TILE_ZOOM);
  const tiles = await Promise.all(
    tilesInBounds(bounds, tileZoom).map((tile) => fetchTileOnce(tileUrl(tile, apiKey)))
  );
  const chargers = new Map();
  for (const poi of tiles.flat()) {
    chargers.set(poi.ID, poi);
  }
  return {
    chargers: [...chargers.values()].map(toCharger).filter(hasLocation),
    truncated: tiles.some((tile) => tile.length >= MAX_RESULTS_PER_TILE),
  };
};

export { deleteExpiredTiles, fetchChargersInBounds };
