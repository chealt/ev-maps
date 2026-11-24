// The routes the signed-in user planned, the latest first, each with the
// filters on when it was planned: kept in the account's settings
// (`routeHistory`, packages/worker/src/settings.js), as routes need an
// account anyway. An entry: { origin, destination, filters, plannedAt }, the
// ends as saved-state.js saves the shown route ({ label, placeId } or
// { label, location }).
//
// The routes saved as favorites are kept the same way (`favoriteRoutes`),
// the latest saved first, and listed before the history.

import { fetchAccountSettings, saveAccountSettings } from "../../lib/account-settings.js";

const MAX_ROUTES = 10;
const MAX_FAVORITE_ROUTES = 20;
const MAX_ROUTE_STOPS = 10;

const endKey = ({ id, placeId, location }) =>
  placeId ? `place:${placeId}` : id ? `charger:${id}` : `at:${location.lat},${location.lng}`;

const stopsKey = (stops = []) => stops.map(endKey).join("|");

const sameRoute = (a, b) =>
  endKey(a.origin) === endKey(b.origin) &&
  endKey(a.destination) === endKey(b.destination) &&
  stopsKey(a.stops) === stopsKey(b.stops);

let routes = null;
let favorites = null;
// One request for the account's settings, for both lists.
let settings = null;
const accountSettings = () => (settings ??= fetchAccountSettings());

// The history, from the account (once per page, then kept up to date here).
const readRouteHistory = async () => {
  routes ??= (await accountSettings())?.routeHistory?.routes ?? [];
  return routes;
};

// Puts a planned route at the top (the same route planned again moves up,
// with the filters of this time), keeping the last MAX_ROUTES.
const recordRoute = async (route) => {
  const history = await readRouteHistory();
  routes = [route, ...history.filter((entry) => !sameRoute(entry, route))].slice(0, MAX_ROUTES);
  await saveAccountSettings({ routeHistory: { routes, updatedAt: Date.now() } });
  return routes;
};

// The favorite routes, from the account (once per page, then kept here).
const readFavoriteRoutes = async () => {
  favorites ??= (await accountSettings())?.favoriteRoutes?.routes ?? [];
  return favorites;
};

const isFavoriteRoute = (route) => (favorites ?? []).some((entry) => sameRoute(entry, route));

// Saves a route as a favorite (at the top) or, saved already, removes it;
// the favorites as they are now.
const toggleFavoriteRoute = async (route) => {
  const saved = await readFavoriteRoutes();
  favorites = saved.some((entry) => sameRoute(entry, route))
    ? saved.filter((entry) => !sameRoute(entry, route))
    : [route, ...saved].slice(0, MAX_FAVORITE_ROUTES);
  await saveAccountSettings({ favoriteRoutes: { routes: favorites, updatedAt: Date.now() } });
  return favorites;
};

// Signed out, the next user's history and favorites are theirs.
const forgetRouteHistory = () => {
  routes = null;
  favorites = null;
  settings = null;
};

export {
  MAX_ROUTE_STOPS,
  endKey,
  forgetRouteHistory,
  isFavoriteRoute,
  readFavoriteRoutes,
  readRouteHistory,
  recordRoute,
  sameRoute,
  toggleFavoriteRoute,
};
