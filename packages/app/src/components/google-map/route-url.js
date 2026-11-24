// A route as a shareable link: the ends and the corridor in the URL's query,
// so opening it plans the same route again (GoogleMap reads it on load).

// The saved shape of a route's end ({ label, placeId } or { label, location }).
const endParams = (prefix, { label, placeId, location }) => {
  const params = new URLSearchParams();
  params.set(`${prefix}`, label);
  if (placeId) {
    params.set(`${prefix}Place`, placeId);
  } else if (location) {
    params.set(`${prefix}Lat`, location.lat.toFixed(5));
    params.set(`${prefix}Lng`, location.lng.toFixed(5));
  }
  return params;
};

// The URL sharing `route` ({ origin, destination, corridorKm }): the page's
// with its query describing the route, e.g.
// "/en/hu/?from=Buda&fromLat=..&fromLng=..&to=Vie&toPlace=..&corridorKm=5".
const routeUrl = ({ origin, destination, corridorKm }) => {
  const params = new URLSearchParams([
    ...endParams("from", origin),
    ...endParams("to", destination),
  ]);
  params.set("corridorKm", String(corridorKm));
  return `${window.location.origin}${window.location.pathname}?${params}${window.location.hash}`;
};

// The route a shared URL describes, or null without one: the same shape
// showRoute takes (with the corridor and the ends' labels and places).
const routeFromUrl = (query = new URLSearchParams(window.location.search)) => {
  const end = (prefix) => {
    const label = query.get(prefix);
    if (!label) {
      return null;
    }
    const placeId = query.get(`${prefix}Place`);
    if (placeId) {
      return { label, placeId };
    }
    const lat = Number(query.get(`${prefix}Lat`));
    const lng = Number(query.get(`${prefix}Lng`));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { label, location: { lat, lng } } : null;
  };
  const origin = end("from");
  const destination = end("to");
  if (!origin || !destination) {
    return null;
  }
  const corridorKm = Number(query.get("corridorKm"));
  return { origin, destination, corridorKm: Number.isFinite(corridorKm) ? corridorKm : undefined };
};

export { routeFromUrl, routeUrl };
