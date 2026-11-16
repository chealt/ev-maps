// The ev-maps Worker. Static assets are served directly; the Worker only
// runs for:
// - /api/chargers/{z}/{x}/{y}: chargers in a map tile, from D1
// - /: the static page, with the chargers nearest the visitor's approximate
//   (IP based) location inlined, so the first view needs no extra request
// It also runs the charger import on a schedule (see import/index.js).

import { tileBounds } from "../src/lib/tiles.js";
import { chargersInBounds, toClientCharger } from "./db.js";
import { runImport } from "./import/index.js";

const MAX_CHARGERS_PER_TILE = 2000;
const MAX_TILE_ZOOM = 18;
// The data changes weekly: browsers keep tiles for an hour, the edge a day.
const TILE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";
const INITIAL_CHARGERS = 150;
// Around the visitor: roughly 30 km.
const INITIAL_RADIUS_DEGREES = 0.3;
// Chargers from different sources this close are taken to be the same one.
const DUPLICATE_DISTANCE_METERS = 60;
const METERS_PER_DEGREE_LAT = 111320;

const json = (data, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

// Prefer the record with the most detail.
const detailScore = (charger) =>
  charger.connectors.filter((connector) => connector.powerKw).length * 2 +
  (charger.status ? 1 : 0) +
  (charger.address ? 1 : 0);

// Approximate distance in meters; fine at these small distances.
const metersBetween = (a, b) => {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// Drops a charger when another source has one within
// DUPLICATE_DISTANCE_METERS, keeping the record with the most detail. Chargers
// from the same source are never merged: separate ones at one car park are
// real. Uses a grid of cells as large as the distance, so only a charger's
// own and neighboring cells need checking.
const withoutDuplicates = (chargers) => {
  const cellSize = DUPLICATE_DISTANCE_METERS / METERS_PER_DEGREE_LAT;
  const cellOf = ({ lat, lng }) => [Math.floor(lat / cellSize), Math.floor(lng / cellSize)];
  const keptByCell = new Map();
  const kept = [];
  for (const charger of [...chargers].sort((a, b) => detailScore(b) - detailScore(a))) {
    const [row, column] = cellOf(charger.location);
    const neighbors = [-1, 0, 1].flatMap((dRow) =>
      [-1, 0, 1].flatMap((dColumn) => keptByCell.get(`${row + dRow},${column + dColumn}`) ?? [])
    );
    const isDuplicate = neighbors.some(
      (other) =>
        other.source !== charger.source &&
        metersBetween(other.location, charger.location) <= DUPLICATE_DISTANCE_METERS
    );
    if (!isDuplicate) {
      kept.push(charger);
      const key = `${row},${column}`;
      keptByCell.set(key, [...(keptByCell.get(key) ?? []), charger]);
    }
  }
  return kept;
};

const tileResponse = async (request, env, { zoom, x, y }, context) => {
  const cached = await caches.default.match(request);
  if (cached) {
    return cached;
  }
  const { rows, full } = await chargersInBounds(
    env.DB,
    tileBounds({ zoom, x, y }),
    MAX_CHARGERS_PER_TILE
  );
  const response = json(
    { chargers: withoutDuplicates(rows.map(toClientCharger)), full },
    { headers: { "cache-control": TILE_CACHE_CONTROL } }
  );
  context.waitUntil(caches.default.put(request, response.clone()));
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

const distanceSquared = (a, b) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

const nearestChargers = async (env, location) => {
  const { rows } = await chargersInBounds(
    env.DB,
    {
      north: location.lat + INITIAL_RADIUS_DEGREES,
      south: location.lat - INITIAL_RADIUS_DEGREES,
      east: location.lng + INITIAL_RADIUS_DEGREES,
      west: location.lng - INITIAL_RADIUS_DEGREES,
    },
    MAX_CHARGERS_PER_TILE
  );
  return withoutDuplicates(rows.map(toClientCharger))
    .sort((a, b) => distanceSquared(a.location, location) - distanceSquared(b.location, location))
    .slice(0, INITIAL_CHARGERS);
};

// JSON inside <script>: escape "<" so data can't close the element.
const scriptJson = (data) => JSON.stringify(data).replaceAll("<", "\\u003c");

// The static page, with the visitor's approximate location and the chargers
// nearest to it. It varies per visitor, so it isn't cached.
const pageWithNearbyChargers = async (request, env) => {
  const page = await env.ASSETS.fetch(new Request(request.url));
  const location = { lat: Number(request.cf?.latitude), lng: Number(request.cf?.longitude) };
  if (!page.ok || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return page;
  }
  const chargers = await nearestChargers(env, location).catch(() => []);
  const response = new HTMLRewriter()
    .on("ev-google-map", {
      element(element) {
        element.setAttribute("data-ip-lat", String(location.lat));
        element.setAttribute("data-ip-lng", String(location.lng));
        element.append(
          `<script type="application/json" class="initial-chargers">${scriptJson(chargers)}</script>`,
          { html: true }
        );
      },
    })
    .transform(page);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("etag");
  return new Response(response.body, { status: response.status, headers });
};

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/api/chargers/")) {
      const tile = parseTile(url.pathname);
      return tile
        ? tileResponse(request, env, tile, context)
        : json({ error: "Not found" }, { status: 404 });
    }
    if (request.method === "GET" && url.pathname === "/") {
      return pageWithNearbyChargers(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  // Awaited, not passed to waitUntil(): work after the handler returns is
  // cancelled after ~30 s, but a scheduled handler itself may run 15 minutes.
  async scheduled(controller, env) {
    // IMPORT_BUDGET_MS shortens a run, e.g. when trying the import locally.
    await runImport(env, { budgetMs: Number(env.IMPORT_BUDGET_MS) || undefined });
  },
};
