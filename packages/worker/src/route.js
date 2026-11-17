// Geometry for chargers along a route: the route is a line of { lat, lng }
// points, and a charger is on the way if it's within a corridor around it.
// Distances use a flat projection around each point, accurate enough for a
// corridor a few kilometres wide.

const METERS_PER_DEGREE_LAT = 111320;
// One bounding-box query per this much of the route: shorter chunks hug a
// winding route more tightly, but each one is a query.
const CHUNK_METERS = 20000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Meters east and north of the origin, in a projection around `refLat`.
const toXY = ({ lat, lng }, refLat) => ({
  x: lng * METERS_PER_DEGREE_LAT * Math.cos(toRadians(refLat)),
  y: lat * METERS_PER_DEGREE_LAT,
});

const metersBetween = (a, b) => {
  const refLat = (a.lat + b.lat) / 2;
  const pa = toXY(a, refLat);
  const pb = toXY(b, refLat);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
};

// The distance from the start to each point of the route.
const cumulativeMeters = (path) =>
  path.reduce(
    (distances, point, index) => [
      ...distances,
      index === 0 ? 0 : distances[index - 1] + metersBetween(path[index - 1], point),
    ],
    []
  );

// The bounding box of `points`, grown by `meters` on every side.
const grownBounds = (points, meters) => {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const latMargin = meters / METERS_PER_DEGREE_LAT;
  // Longitude degrees are shortest at the latitude farthest from the equator.
  const widestLat = Math.min(89, Math.max(Math.abs(north), Math.abs(south)));
  const lngMargin = meters / (METERS_PER_DEGREE_LAT * Math.cos(toRadians(widestLat)));
  return {
    north: north + latMargin,
    south: south - latMargin,
    east: Math.max(...lngs) + lngMargin,
    west: Math.min(...lngs) - lngMargin,
  };
};

// The route in chunks of about CHUNK_METERS: each has its segments
// (`from` to `to`, exclusive; segment i joins points i and i + 1) and a
// bounding box that holds everything within `corridorMeters` of them.
const routeChunks = (path, corridorMeters, cumulative = cumulativeMeters(path)) => {
  const chunks = [];
  let from = 0;
  for (let index = 1; index < path.length; index++) {
    const isLast = index === path.length - 1;
    if (isLast || cumulative[index] - cumulative[from] >= CHUNK_METERS) {
      chunks.push({
        from,
        to: index,
        bounds: grownBounds(path.slice(from, index + 1), corridorMeters),
      });
      from = index;
    }
  }
  return chunks;
};

const isInBounds = ({ lat, lng }, { north, south, east, west }) =>
  lat >= south && lat <= north && lng >= west && lng <= east;

// The point of the route closest to `point`: how far it is from the route,
// and how far along the route (from the start) that closest point is.
const nearestOnRoute = (path, cumulative, point, chunks) => {
  let best = { fromRoute: Infinity, along: 0 };
  for (const { from, to, bounds } of chunks) {
    if (!isInBounds(point, bounds)) {
      continue;
    }
    for (let index = from; index < to; index++) {
      const a = toXY(path[index], point.lat);
      const b = toXY(path[index + 1], point.lat);
      const p = toXY(point, point.lat);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t =
        lengthSquared === 0
          ? 0
          : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
      const fromRoute = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (fromRoute < best.fromRoute) {
        best = {
          fromRoute,
          along: cumulative[index] + t * (cumulative[index + 1] - cumulative[index]),
        };
      }
    }
  }
  return best;
};

export { cumulativeMeters, nearestOnRoute, routeChunks };
