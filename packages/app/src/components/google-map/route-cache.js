// How a reload uses the route planned before it: the route's path, its legs
// and the chargers along it are saved with it, so the page shows them at
// once instead of planning again ("Planning the route…") while the user waits.

// Younger than this, the saved route is shown as it is.
const ROUTE_REFRESH_MS = 60 * 60 * 1000;
// Older, it's shown, and planned again in the background (roads, chargers
// and their places change); the new plan replaces it when it differs.
// Older than this, it's too old to show: the route is planned again first.
const ROUTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const isPoint = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng);

// A saved plan: { path: [{ lat, lng }], stopDistances: [meters], chargers,
// full, plannedAt }.
const isPlan = (plan) =>
  Array.isArray(plan?.path) &&
  plan.path.length > 0 &&
  plan.path.every(isPoint) &&
  Array.isArray(plan.chargers) &&
  Array.isArray(plan.stopDistances) &&
  Number.isFinite(plan.plannedAt);

// "fresh": show it; "stale": show it and plan again in the background;
// "expired" (or no valid plan): plan again first.
const planState = (plan, now = Date.now()) => {
  if (!isPlan(plan)) {
    return "expired";
  }
  const age = now - plan.plannedAt;
  if (age < 0 || age >= ROUTE_MAX_AGE_MS) {
    return "expired";
  }
  return age < ROUTE_REFRESH_MS ? "fresh" : "stale";
};

// Whether a new plan shows anything different: another path, other legs,
// or other chargers along it.
const samePlan = (a, b) =>
  a.path.length === b.path.length &&
  a.path.every(
    (point, index) => point.lat === b.path[index].lat && point.lng === b.path[index].lng
  ) &&
  a.stopDistances.join() === b.stopDistances.join() &&
  a.full === b.full &&
  a.chargers.map((charger) => charger.id).join() === b.chargers.map((charger) => charger.id).join();

export { ROUTE_MAX_AGE_MS, ROUTE_REFRESH_MS, isPlan, planState, samePlan };
