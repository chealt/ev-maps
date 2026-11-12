// Loads EV chargers from Open Charge Map (https://openchargemap.org).
//
// The visible map area is split into fixed Web Mercator tiles, so the same
// area always produces the same requests. Tiles are requested in compact form
// (IDs instead of names, about a quarter of the size) and the names come from
// Open Charge Map's reference data. Every response is kept in Cache Storage
// for a day, so panning back or reloading doesn't hit the API.

const API_URL = "https://api.openchargemap.io/v3";
const CACHE_NAME = "ev-maps-open-charge-map-v1";
const CACHED_AT_HEADER = "x-ev-maps-cached-at";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS_PER_TILE = 2000;
// Tiles are 2 zoom levels larger than the map, so a viewport covers ~2×2 tiles.
const TILE_ZOOM_OFFSET = 2;
const MAX_TILE_ZOOM = 14;
// A full tile is an arbitrary sample of a dense area, so it's split into its
// four smaller tiles, at most this many times.
const MAX_SPLIT_DEPTH = 2;

const inFlightRequests = new Map();

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

const tileBounds = ({ x, y, zoom }) => ({
  north: tileYToLat(y, zoom),
  south: tileYToLat(y + 1, zoom),
  west: tileXToLng(x, zoom),
  east: tileXToLng(x + 1, zoom),
});

const intersects = (a, b) =>
  a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;

const childTiles = ({ x, y, zoom }) =>
  [0, 1].flatMap((dx) => [0, 1].map((dy) => ({ x: 2 * x + dx, y: 2 * y + dy, zoom: zoom + 1 })));

const tileUrl = (tile, apiKey) => {
  const { north, south, east, west } = tileBounds(tile);
  const params = new URLSearchParams({
    output: "json",
    boundingbox: `(${south},${west}),(${north},${east})`,
    maxresults: String(MAX_RESULTS_PER_TILE),
    compact: "true",
    verbose: "false",
    key: apiKey,
  });
  return `${API_URL}/poi?${params}`;
};

const referenceDataUrl = (apiKey) =>
  `${API_URL}/referencedata?${new URLSearchParams({ output: "json", key: apiKey })}`;

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

const fetchFromApi = async (url, cache) => {
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

const fetchCached = async (url) => {
  const cache = await openCache();
  const cached = await cache?.match(url);
  if (cached && isFresh(cached)) {
    return cached.json();
  }
  return fetchFromApi(url, cache);
};

// Shares one request between callers asking for the same URL at the same time.
const fetchCachedOnce = (url) => {
  if (!inFlightRequests.has(url)) {
    inFlightRequests.set(
      url,
      fetchCached(url).finally(() => inFlightRequests.delete(url))
    );
  }
  return inFlightRequests.get(url);
};

const titlesById = (items = []) => new Map(items.map(({ ID, Title }) => [ID, Title]));

const fetchReferenceData = async (apiKey) => {
  const data = await fetchCachedOnce(referenceDataUrl(apiKey));
  return {
    operators: titlesById(data.Operators),
    usageTypes: titlesById(data.UsageTypes),
    statusTypes: titlesById(data.StatusTypes),
    connectionTypes: titlesById(data.ConnectionTypes),
  };
};

const deleteExpiredResponses = async () => {
  const cache = await openCache();
  for (const request of (await cache?.keys()) ?? []) {
    const response = await cache.match(request);
    if (response && !isFresh(response)) {
      await cache.delete(request);
    }
  }
};

// Loads a tile; if it's full, loads its smaller tiles in view instead.
const fetchTileChargers = async ({ tile, bounds, apiKey, depth = 0 }) => {
  const pois = await fetchCachedOnce(tileUrl(tile, apiKey));
  const full = pois.length >= MAX_RESULTS_PER_TILE;
  if (!full || depth >= MAX_SPLIT_DEPTH || tile.zoom >= MAX_TILE_ZOOM) {
    return { pois, truncated: full };
  }
  const children = await Promise.all(
    childTiles(tile)
      .filter((child) => intersects(tileBounds(child), bounds))
      .map((child) => fetchTileChargers({ tile: child, bounds, apiKey, depth: depth + 1 }))
  );
  return {
    pois: children.flatMap((child) => child.pois),
    truncated: children.some((child) => child.truncated),
  };
};

const toCharger = (poi, reference) => ({
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
  operator: reference.operators.get(poi.OperatorID),
  usageType: reference.usageTypes.get(poi.UsageTypeID),
  usageCost: poi.UsageCost,
  status: reference.statusTypes.get(poi.StatusTypeID),
  numberOfPoints: poi.NumberOfPoints,
  connectors: (poi.Connections ?? []).map((connection) => ({
    type: reference.connectionTypes.get(connection.ConnectionTypeID) || "Unknown connector",
    powerKw: connection.PowerKW,
    quantity: connection.Quantity,
  })),
});

const hasLocation = ({ location }) =>
  Number.isFinite(location.lat) && Number.isFinite(location.lng);

const fetchChargersInBounds = async ({ bounds, zoom, apiKey }) => {
  const tileZoom = clamp(Math.floor(zoom) - TILE_ZOOM_OFFSET, 0, MAX_TILE_ZOOM);
  const [reference, ...tiles] = await Promise.all([
    fetchReferenceData(apiKey),
    ...tilesInBounds(bounds, tileZoom).map((tile) => fetchTileChargers({ tile, bounds, apiKey })),
  ]);
  const chargers = new Map();
  for (const poi of tiles.flatMap((tile) => tile.pois)) {
    chargers.set(poi.ID, poi);
  }
  return {
    chargers: [...chargers.values()].map((poi) => toCharger(poi, reference)).filter(hasLocation),
    truncated: tiles.some((tile) => tile.truncated),
  };
};

export { deleteExpiredResponses, fetchChargersInBounds };
