// The routes the signed-in user planned, the latest first, each with the
// filters on when it was planned: kept in the account's settings
// (`routeHistory`, packages/worker/src/settings.js), as routes need an
// account anyway. An entry: { origin, destination, filters, plannedAt }, the
// ends as saved-state.js saves the shown route ({ label, placeId } or
// { label, location }).

import { fetchAccountSettings, saveAccountSettings } from "../../lib/account-settings.js";

const MAX_ROUTES = 10;

const endKey = ({ placeId, location }) =>
  placeId ? `place:${placeId}` : `at:${location.lat},${location.lng}`;

const sameRoute = (a, b) =>
  endKey(a.origin) === endKey(b.origin) && endKey(a.destination) === endKey(b.destination);

let routes = null;

// The history, from the account (once per page, then kept up to date here).
const readRouteHistory = async () => {
  routes ??= (await fetchAccountSettings())?.routeHistory?.routes ?? [];
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

// Signed out, the next user's history is theirs.
const forgetRouteHistory = () => {
  routes = null;
};

export { forgetRouteHistory, readRouteHistory, recordRoute };
