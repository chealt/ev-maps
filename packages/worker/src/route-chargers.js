// POST /api/chargers/route: the chargers within a corridor around a route,
// in order along it. The body is { path: [[lat, lng], ...], corridorKm }; the
// page sends the route Google planned, thinned to MAX_POINTS.

import { chargersInEachBounds, toClientCharger } from "./db.js";
import { mergeDuplicates } from "./duplicates.js";
import { cumulativeMeters, nearestOnRoute, routeChunks } from "./route.js";

const MAX_POINTS = 5000;
const DEFAULT_CORRIDOR_KM = 5;
const MIN_CORRIDOR_KM = 1;
const MAX_CORRIDOR_KM = 10;
// Per chunk of the route, and in all; beyond these the answer says it's full.
const MAX_CHARGERS_PER_CHUNK = 2000;
const MAX_CHARGERS = 5000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const isLatLng = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  Number.isFinite(point[0]) &&
  Number.isFinite(point[1]) &&
  Math.abs(point[0]) <= 90 &&
  Math.abs(point[1]) <= 180;

// The route and corridor from the request body, or an error message.
const parseRouteRequest = (body) => {
  const path = body?.path;
  if (!Array.isArray(path) || path.length < 2 || path.length > MAX_POINTS) {
    return { error: `path must have 2 to ${MAX_POINTS} points` };
  }
  if (!path.every(isLatLng)) {
    return { error: "path must be [lat, lng] pairs" };
  }
  const corridorKm = body.corridorKm ?? DEFAULT_CORRIDOR_KM;
  if (
    !Number.isFinite(corridorKm) ||
    corridorKm < MIN_CORRIDOR_KM ||
    corridorKm > MAX_CORRIDOR_KM
  ) {
    return { error: `corridorKm must be ${MIN_CORRIDOR_KM} to ${MAX_CORRIDOR_KM}` };
  }
  return { path: path.map(([lat, lng]) => ({ lat, lng })), corridorMeters: corridorKm * 1000 };
};

const chargersAlongRoute = async (db, { path, corridorMeters }) => {
  const cumulative = cumulativeMeters(path);
  const chunks = routeChunks(path, corridorMeters, cumulative);
  const results = await chargersInEachBounds(
    db,
    chunks.map((chunk) => chunk.bounds),
    MAX_CHARGERS_PER_CHUNK
  );
  // Neighboring chunks' boxes overlap, so a charger can come back twice.
  const rowsById = new Map(results.flatMap(({ rows }) => rows.map((row) => [row.rid, row])));
  const along = [];
  for (const row of rowsById.values()) {
    const { fromRoute, along: fromStart } = nearestOnRoute(
      path,
      cumulative,
      { lat: row.lat, lng: row.lng },
      chunks
    );
    if (fromRoute <= corridorMeters) {
      along.push({
        ...toClientCharger(row),
        route: {
          distanceFromStartMeters: Math.round(fromStart),
          distanceFromRouteMeters: Math.round(fromRoute),
        },
      });
    }
  }
  const sorted = mergeDuplicates(along).sort(
    (a, b) => a.route.distanceFromStartMeters - b.route.distanceFromStartMeters
  );
  return {
    chargers: sorted.slice(0, MAX_CHARGERS),
    full: sorted.length > MAX_CHARGERS || results.some(({ full }) => full),
  };
};

const routeChargersResponse = async (request, env) => {
  const body = await request.json().catch(() => null);
  const parsed = parseRouteRequest(body);
  if (parsed.error) {
    return json({ error: parsed.error }, 400);
  }
  return json(await chargersAlongRoute(env.DB, parsed));
};

export { routeChargersResponse };
