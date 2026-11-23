// A route's line for the Worker's POST /api/chargers/route, and its chargers.

// The Worker takes at most 5000 points (packages/worker/src/route-chargers.js).
const MAX_POINTS = 5000;
// Points closer than this to the last one kept add nothing to a corridor of
// even 1 km (the narrowest choice).
const MIN_STEP_METERS = 200;
// How far from the route chargers are shown, in km: the planner's choices
// (within the Worker's 1 to 10, packages/worker/src/route-chargers.js), and
// the default, also for routes saved before it could be chosen.
const CORRIDOR_OPTIONS_KM = [1, 2, 5, 10];
const CORRIDOR_KM = 5;
const METERS_PER_DEGREE_LAT = 111320;
// 5 decimals is about a meter.
const COORDINATE_DECIMALS = 5;

const roughMeters = (a, b) => {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (b.lng - a.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// Google's route points as { lat, lng }: LatLng has methods, LatLngAltitude
// and literals have numbers.
const toLatLng = (point) =>
  typeof point.lat === "function"
    ? { lat: point.lat(), lng: point.lng() }
    : { lat: point.lat, lng: point.lng };

// Keeps the first and last point, and points at least `step` meters apart,
// doubling the step until the route fits in MAX_POINTS.
const thinPath = (path, step = MIN_STEP_METERS) => {
  const kept = [path[0]];
  for (const point of path.slice(1, -1)) {
    if (roughMeters(kept.at(-1), point) >= step) {
      kept.push(point);
    }
  }
  kept.push(path.at(-1));
  return kept.length > MAX_POINTS ? thinPath(path, step * 2) : kept;
};

const pathBounds = (path) => {
  const lats = path.map((point) => point.lat);
  const lngs = path.map((point) => point.lng);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
};

const fetchChargersAlongRoute = async (path, corridorKm = CORRIDOR_KM) => {
  const response = await fetch("/api/chargers/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: thinPath(path).map(({ lat, lng }) => [
        Number(lat.toFixed(COORDINATE_DECIMALS)),
        Number(lng.toFixed(COORDINATE_DECIMALS)),
      ]),
      corridorKm,
    }),
  });
  if (!response.ok) {
    throw new Error(`Route chargers request failed: ${response.status}`);
  }
  return response.json();
};

export { CORRIDOR_KM, CORRIDOR_OPTIONS_KM, fetchChargersAlongRoute, pathBounds, toLatLng };
