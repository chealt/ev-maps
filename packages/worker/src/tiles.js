// GET /api/chargers/{z}/{x}/{y}: the chargers in a map tile, from D1, with
// each charger's records from different sources merged into one. Open to
// everyone, cached at the edge.

import { TILE_FORMAT_VERSION, tileBounds } from "@ev-maps/tiles";
import { chargersInBounds, toClientCharger } from "./db.js";
import { mergeDuplicates } from "./duplicates.js";

const MAX_CHARGERS_PER_TILE = 2000;
const MAX_TILE_ZOOM = 18;
// The data changes weekly: browsers keep tiles for an hour, the edge a day.
const TILE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

const json = (data, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

// Tiles are cached by their path and the current format, whatever the query
// string: a new format starts a new cache, and random queries can't fill it.
const tileCacheKey = (request) => {
  const url = new URL(request.url);
  return new Request(new URL(`${url.pathname}?v=${TILE_FORMAT_VERSION}`, url.origin));
};

const tileResponse = async (request, env, { zoom, x, y }, context) => {
  const cacheKey = tileCacheKey(request);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return cached;
  }
  const { rows, full } = await chargersInBounds(
    env.DB,
    tileBounds({ zoom, x, y }),
    MAX_CHARGERS_PER_TILE
  );
  const response = json(
    { chargers: mergeDuplicates(rows.map(toClientCharger)), full },
    { headers: { "cache-control": TILE_CACHE_CONTROL } }
  );
  context.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
};

const parseTile = (pathname) => {
  const match = /^\/api\/chargers\/(\d+)\/(\d+)\/(\d+)$/.exec(pathname);
  if (!match) {
    return null;
  }
  const [zoom, x, y] = match.slice(1).map(Number);
  const tiles = 2 ** zoom;
  return zoom <= MAX_TILE_ZOOM && x < tiles && y < tiles ? { zoom, x, y } : null;
};

const routes = [
  {
    name: "tiles",
    limiter: "TILE_LIMITER",
    signedIn: false,
    matches: (request, url) =>
      request.method === "GET" && url.pathname.startsWith("/api/chargers/"),
    handle: ({ request, env, url, context }) => {
      const tile = parseTile(url.pathname);
      return tile
        ? tileResponse(request, env, tile, context)
        : json({ error: "Not found" }, { status: 404 });
    },
  },
];

export { parseTile, routes };
