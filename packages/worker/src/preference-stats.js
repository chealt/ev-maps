// What users prefer, for the admin area's Usage pages (#373): how many
// accounts chose each option of each setting, and how many page views had
// each of the device's own settings (the theme, animations, the language).
//
// - GET /api/admin/preferences: { accounts, groups: { [id]: { unit, rows } } }
//   (admin). `unit` is "users" (accounts now, from the main database) or
//   "pageViews" (the last PAGE_VIEW_DAYS days, from the usage counts); each
//   group's rows are [{ value, count }], most first.
//
// Only counts: the routes and places users chose are listed only when at
// least MIN_USERS accounts have the same one, so nobody's own shows.

const PREFERENCES_PATH = "/api/admin/preferences";
const PAGE_VIEW_DAYS = 30;
const MIN_USERS = 3;
const MAX_ROWS = 10;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });

const parse = (data) => {
  try {
    return JSON.parse(data) ?? {};
  } catch {
    return {};
  }
};

// Counts each value once per user: `values` is a user's list of them.
const tally = () => {
  const counts = new Map();
  return {
    add(values) {
      for (const value of new Set(values)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    },
    rows({ min = 1, max = Infinity } = {}) {
      return [...counts]
        .filter(([, count]) => count >= min)
        .map(([value, count]) => ({ value: String(value), count }))
        .toSorted((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, max);
    },
  };
};

const placeName = (end) => end?.label?.trim();

// The account settings' groups, each user counted once per value.
const settingsGroups = (settings) => {
  const groups = {
    distanceUnit: tally(),
    mapsApp: tally(),
    savedPlacesOnMap: tally(),
    carConnectors: tally(),
    carAutoFilter: tally(),
    filterConnectorTypes: tally(),
    filterPowerRanges: tally(),
    filterPriceLevels: tally(),
    filterNearby: tally(),
    filterOnlyFavorites: tally(),
    filterHideUnavailable: tally(),
    filterExcludedOperators: tally(),
    features: tally(),
    savedPlaceIcons: tally(),
    popularDestinations: tally(),
    popularRoutes: tally(),
  };
  for (const data of settings) {
    const { filters = {}, car, mapsApp, distanceUnit, savedPlacesOnMap } = data;
    const { savedPlaces, favoriteRoutes, routeHistory } = data;
    // Unset is the default: the locale's unit, asking for the app, shown.
    groups.distanceUnit.add([distanceUnit?.unit ?? "auto"]);
    groups.mapsApp.add([mapsApp?.app ?? "ask"]);
    groups.savedPlacesOnMap.add([String(savedPlacesOnMap?.shown ?? true)]);
    if (car) {
      groups.carConnectors.add(car.connectors ?? []);
      groups.carAutoFilter.add([String(Boolean(car.autoFilter))]);
    }
    groups.filterConnectorTypes.add(filters.connectorTypes ?? []);
    groups.filterPowerRanges.add(filters.powerRanges ?? []);
    groups.filterPriceLevels.add(filters.priceLevels ?? []);
    groups.filterNearby.add(filters.nearby ?? []);
    groups.filterOnlyFavorites.add([String(Boolean(filters.onlyFavorites))]);
    groups.filterHideUnavailable.add([String(Boolean(filters.hideUnavailable))]);
    groups.filterExcludedOperators.add(filters.excludedOperators ?? []);
    const places = savedPlaces?.places ?? [];
    const routes = [...(favoriteRoutes?.routes ?? []), ...(routeHistory?.routes ?? [])];
    groups.features.add(
      [
        places.length && "savedPlaces",
        favoriteRoutes?.routes?.length && "favoriteRoutes",
        routeHistory?.routes?.length && "routeHistory",
        car?.connectors?.length && "car",
      ].filter(Boolean)
    );
    groups.savedPlaceIcons.add(places.map(({ icon }) => icon));
    groups.popularDestinations.add(routes.map(({ destination }) => placeName(destination)).filter(Boolean));
    groups.popularRoutes.add(
      routes
        .map(({ origin, destination }) => [placeName(origin), placeName(destination)])
        .filter(([from, to]) => from && to)
        .map(([from, to]) => `${from} → ${to}`)
    );
  }
  const anonymous = new Set(["popularDestinations", "popularRoutes", "filterExcludedOperators"]);
  return Object.fromEntries(
    Object.entries(groups).map(([id, group]) => [
      id,
      {
        unit: "users",
        rows: anonymous.has(id) ? group.rows({ min: MIN_USERS, max: MAX_ROWS }) : group.rows(),
      },
    ])
  );
};

// How users sign in: each provider's accounts, the passkeys', and email
// (a sign-in link) for users with no provider's account.
const signInGroup = async (db) => {
  const [{ results: providers }, passkeys, linkOnly] = await Promise.all([
    db
      .prepare(
        `SELECT "providerId" AS value, COUNT(DISTINCT "userId") AS count FROM "account"
         GROUP BY "providerId"`
      )
      .all(),
    db.prepare(`SELECT COUNT(DISTINCT "userId") AS count FROM "passkey"`).first(),
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM "user" u
         WHERE NOT EXISTS (SELECT 1 FROM "account" a WHERE a."userId" = u."id")`
      )
      .first(),
  ]);
  const rows = [
    ...providers,
    { value: "passkey", count: passkeys?.count ?? 0 },
    { value: "email", count: linkOnly?.count ?? 0 },
  ]
    .filter(({ count }) => count > 0)
    .toSorted((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return { unit: "users", rows };
};

// The device's own settings, from the pages' usage counts: the page views
// in each language, and with each theme and animations setting.
const deviceGroups = async (adminDb, now = Date.now()) => {
  const since = new Date(now - PAGE_VIEW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { results } = adminDb
    ? await adminDb
        .prepare(
          `SELECT event, dimension, SUM(count) AS count FROM usage_daily
           WHERE day >= ? AND event IN ('page_view', 'preference')
           GROUP BY event, dimension`
        )
        .bind(since)
        .all()
    : { results: [] };
  const groups = { language: tally(), theme: tally(), animations: tally() };
  const totals = { language: new Map(), theme: new Map(), animations: new Map() };
  for (const { event, dimension, count } of results) {
    const [key, value] =
      event === "page_view" ? ["language", dimension.split(":")[0]] : dimension.split(":");
    if (totals[key]) {
      totals[key].set(value, (totals[key].get(value) ?? 0) + count);
    }
  }
  return Object.fromEntries(
    Object.keys(groups).map((id) => [
      id,
      {
        unit: "pageViews",
        rows: [...totals[id]]
          .map(([value, count]) => ({ value, count }))
          .toSorted((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      },
    ])
  );
};

const preferenceStats = async (env, now = Date.now()) => {
  const [{ results }, signIn, device, users] = await Promise.all([
    env.DB.prepare("SELECT data FROM user_settings").all(),
    signInGroup(env.DB),
    deviceGroups(env.ADMIN_DB, now),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM "user"`).first(),
  ]);
  return {
    accounts: users?.count ?? 0,
    pageViewDays: PAGE_VIEW_DAYS,
    groups: { signIn, ...device, ...settingsGroups(results.map(({ data }) => parse(data))) },
  };
};

const routes = [
  {
    name: "admin-preferences",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => url.pathname === PREFERENCES_PATH,
    handle: async ({ request, env }) =>
      request.method === "GET"
        ? json(await preferenceStats(env))
        : json({ error: "Method not allowed" }, 405),
  },
];

export { MIN_USERS, preferenceStats, routes };
