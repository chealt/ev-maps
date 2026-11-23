// Settings saved to a signed-in user's account: GET /api/settings reads
// them, PUT /api/settings saves some. They're sections (e.g. `filters`), each
// with `updatedAt`, the time the user changed it: a saved section replaces
// the account's only if it's newer, so devices can't undo each other's newer
// changes.

const SETTINGS_PATH = "/api/settings";
const MAX_BODY_BYTES = 32 * 1024;
// Sections and what's allowed in them.
const SECTIONS = {
  filters: {
    powerRanges: (value) => isStringList(value, 10),
    connectorTypes: (value) => isStringList(value, 20),
    // The price levels on: "1" cheaper, "2" average, "3" pricier.
    priceLevels: (value) =>
      isStringList(value, 3) && value.every((level) => ["1", "2", "3"].includes(level)),
    // Operator names as the charger data has them; "" is "unknown operator".
    excludedOperators: (value) => isStringList(value, 200, 120),
    onlyFavorites: (value) => typeof value === "boolean",
    // Hide chargers whose live statuses say none of their points is free.
    hideUnavailable: (value) => typeof value === "boolean",
    // Kinds of places that must be next to a charger (src/amenities.js).
    nearby: (value) => isStringList(value, 10),
  },
  // The routes the user planned, the latest first, each with the filters on
  // when it was planned (the app's src/components/google-map/route-history.js).
  routeHistory: {
    routes: (value) => Array.isArray(value) && value.length <= MAX_ROUTES && value.every(isRoute),
  },
  // The routes the user saved as favorites, listed before the history, in
  // the same shape (the app's src/components/google-map/route-history.js).
  favoriteRoutes: {
    routes: (value) =>
      Array.isArray(value) && value.length <= MAX_FAVORITE_ROUTES && value.every(isRoute),
  },
  // The app "Open in maps" opens a charger in, remembered when the user
  // asked; null asks every time (the app's src/lib/maps-app.js).
  mapsApp: {
    app: (value) => value === null || MAPS_APPS.includes(value),
  },
  // The unit distances are shown in; null follows the user's locale (the
  // app's src/lib/distance-unit.js).
  distanceUnit: {
    unit: (value) => value === null || DISTANCE_UNITS.includes(value),
  },
};

const DISTANCE_UNITS = ["metric", "imperial"];

const MAPS_APPS = ["google", "osm", "apple"];

const MAX_ROUTES = 10;
const MAX_FAVORITE_ROUTES = 20;

const isLocation = (location) =>
  Number.isFinite(location?.lat) &&
  Number.isFinite(location?.lng) &&
  Math.abs(location.lat) <= 90 &&
  Math.abs(location.lng) <= 180;

// A route's end: a Google place by its ID, or a location, with its label.
const isRouteEnd = (end) =>
  typeof end?.label === "string" &&
  end.label.length <= 200 &&
  ((typeof end.placeId === "string" && end.placeId.length <= 300) || isLocation(end.location));

// The filters on when it was planned: as the filters section, without its
// updatedAt.
const isRouteFilters = (filters) =>
  typeof filters === "object" &&
  filters !== null &&
  Object.entries(filters).every(([field, value]) => SECTIONS.filters[field]?.(value));

const isRoute = (route) =>
  isRouteEnd(route?.origin) &&
  isRouteEnd(route?.destination) &&
  isRouteFilters(route?.filters) &&
  Number.isFinite(route?.plannedAt);

const isStringList = (value, max, maxLength = 40) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((item) => typeof item === "string" && item.length <= maxLength);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// The section, if it's a known one in the right shape.
const validSection = (name, section) => {
  const fields = SECTIONS[name];
  if (!fields || typeof section !== "object" || section === null) {
    return false;
  }
  if (!Number.isFinite(section.updatedAt)) {
    return false;
  }
  return Object.entries(section).every(
    ([field, value]) => field === "updatedAt" || fields[field]?.(value)
  );
};

// The account's settings with `changes` applied: each changed section that's
// newer than the account's.
const mergeSettings = (stored, changes) => {
  const merged = { ...stored };
  for (const [name, section] of Object.entries(changes)) {
    if (!(stored[name]?.updatedAt >= section.updatedAt)) {
      merged[name] = section;
    }
  }
  return merged;
};

const readSettings = async (db, userId) => {
  const row = await db
    .prepare("SELECT data FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first();
  return row ? JSON.parse(row.data) : {};
};

const settingsResponse = async (request, env, userId) => {
  if (request.method === "GET") {
    return json({ settings: await readSettings(env.DB, userId) });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let changes;
  try {
    changes = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  if (
    typeof changes !== "object" ||
    changes === null ||
    !Object.entries(changes).every(([name, section]) => validSection(name, section))
  ) {
    return json({ error: "Unknown or invalid settings" }, 400);
  }
  const settings = mergeSettings(await readSettings(env.DB, userId), changes);
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(userId, JSON.stringify(settings), Date.now())
    .run();
  return json({ settings });
};

const routes = [
  {
    name: "settings",
    limiter: "SETTINGS_LIMITER",
    signedIn: true,
    matches: (request, url) =>
      (request.method === "GET" || request.method === "PUT") && url.pathname === SETTINGS_PATH,
    handle: ({ request, env, userId }) => settingsResponse(request, env, userId),
  },
];

export { SETTINGS_PATH, mergeSettings, routes, settingsResponse, validSection };
