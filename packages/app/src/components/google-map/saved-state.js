// The map view and filters, kept in IndexedDB so a reload restores them.
import { get, set } from "idb-keyval";

const FILTERS_KEY = "ev-maps:filters";
const MAP_VIEW_KEY = "ev-maps:map-view";
const ROUTE_KEY = "ev-maps:route";
// Older versions kept the Locate Me position in localStorage.
const LEGACY_LOCATION_KEY = "ev-maps:last-location";

const read = async (key) => {
  try {
    return await get(key);
  } catch {
    // IndexedDB can be unavailable (e.g. some private browsing modes).
    return undefined;
  }
};

const write = async (key, value) => {
  try {
    await set(key, value);
  } catch {
    // IndexedDB can be unavailable (e.g. some private browsing modes).
  }
};

const isLocation = (location) => Number.isFinite(location?.lat) && Number.isFinite(location?.lng);

const readLegacyLocation = () => {
  try {
    const location = JSON.parse(localStorage.getItem(LEGACY_LOCATION_KEY));
    localStorage.removeItem(LEGACY_LOCATION_KEY);
    return isLocation(location) ? location : null;
  } catch {
    return null;
  }
};

// { center: { lat, lng }, zoom }, or null when nothing valid is saved.
const readMapView = async () => {
  const view = await read(MAP_VIEW_KEY);
  if (isLocation(view?.center) && Number.isFinite(view?.zoom)) {
    return view;
  }
  const legacyLocation = readLegacyLocation();
  return legacyLocation ? { center: legacyLocation, zoom: null } : null;
};

const saveMapView = ({ center, zoom }) => write(MAP_VIEW_KEY, { center, zoom });

const stringList = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

// { powerRanges: ["150-300", ...], connectorTypes: ["ccs", ...],
//   excludedOperators: ["Operator", ...], onlyFavorites, hideUnavailable,
//   nearby: ["coffee", ...], updatedAt },
// updatedAt being when the user last changed them (0 if never).
const readFilters = async () => {
  const filters = await read(FILTERS_KEY);
  return {
    powerRanges: stringList(filters?.powerRanges),
    connectorTypes: stringList(filters?.connectorTypes),
    excludedOperators: stringList(filters?.excludedOperators),
    onlyFavorites: filters?.onlyFavorites === true,
    hideUnavailable: filters?.hideUnavailable === true,
    nearby: stringList(filters?.nearby),
    updatedAt: Number(filters?.updatedAt) || 0,
  };
};

const saveFilters = (filters) => write(FILTERS_KEY, filters);

// The shown route's ends, as { label, placeId } (a Google place) or
// { label, location }, so a reload shows it again; null once it's cleared.
const isEnd = (end) =>
  typeof end?.label === "string" && (typeof end.placeId === "string" || isLocation(end.location));

const readRoute = async () => {
  const route = await read(ROUTE_KEY);
  return isEnd(route?.origin) && isEnd(route?.destination) ? route : null;
};

const saveRoute = (route) => write(ROUTE_KEY, route);

export { readFilters, readMapView, readRoute, saveFilters, saveMapView, saveRoute };
