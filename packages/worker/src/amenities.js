// Places next to chargers, from OpenStreetMap (© OpenStreetMap contributors,
// ODbL): a charger has a kind of place when one is within NEARBY_METERS.
// Stored per charger as a bit per kind.

const AMENITIES = [
  { id: "coffee", bit: 1, selector: 'nwr["amenity"="cafe"]' },
  { id: "toilets", bit: 2, selector: 'nwr["amenity"="toilets"]' },
  { id: "restaurant", bit: 4, selector: 'nwr["amenity"~"^(restaurant|fast_food)$"]' },
  { id: "playground", bit: 8, selector: 'nwr["leisure"="playground"]' },
];
const NEARBY_METERS = 150;
const METERS_PER_DEGREE = 111320;

// The kinds' IDs in a bitmask, e.g. 5 → ["coffee", "restaurant"].
const amenityIds = (mask) => AMENITIES.filter(({ bit }) => mask & bit).map(({ id }) => id);

// The bounds grown by NEARBY_METERS on every side, so chargers at the edge
// see places just outside.
const withMargin = ({ south, west, north, east }) => {
  const latMargin = NEARBY_METERS / METERS_PER_DEGREE;
  const lngMargin =
    latMargin / Math.cos((Math.max(Math.abs(south), Math.abs(north)) * Math.PI) / 180);
  return {
    south: south - latMargin,
    west: west - lngMargin,
    north: north + latMargin,
    east: east + lngMargin,
  };
};

// One Overpass query for every kind: each kind's places (centers only, no
// tags), then a count, which marks where the next kind starts.
const amenitiesQuery = (bounds) => {
  const { south, west, north, east } = withMargin(bounds);
  const box = [south, west, north, east].map((value) => value.toFixed(5)).join(",");
  return `[out:json][timeout:120];${AMENITIES.map(
    ({ selector }) => `${selector}(${box});out skel center qt;out count;`
  ).join("")}`;
};

// [{ bit, lat, lng }] from the query's elements.
const parsePlaces = (elements) => {
  const places = [];
  let kind = 0;
  for (const element of elements) {
    if (element.type === "count") {
      kind++;
      continue;
    }
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (AMENITIES[kind] && Number.isFinite(lat) && Number.isFinite(lng)) {
      places.push({ bit: AMENITIES[kind].bit, lat, lng });
    }
  }
  return places;
};

// Each charger's bitmask of the places within NEARBY_METERS: places are put
// in a grid of NEARBY_METERS cells (flat, around `originLat`), so a charger
// only checks its own and the neighboring cells.
const amenityMasks = (chargers, places, originLat) => {
  const lngScale = METERS_PER_DEGREE * Math.cos((originLat * Math.PI) / 180);
  const toXY = ({ lat, lng }) => [lng * lngScale, lat * METERS_PER_DEGREE];
  const cellOf = ([x, y]) => [Math.floor(x / NEARBY_METERS), Math.floor(y / NEARBY_METERS)];
  const grid = new Map();
  for (const place of places) {
    const xy = toXY(place);
    const key = cellOf(xy).join(",");
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push({ bit: place.bit, xy });
  }
  return chargers.map((charger) => {
    const [x, y] = toXY(charger);
    const [column, row] = cellOf([x, y]);
    let mask = 0;
    for (const dColumn of [-1, 0, 1]) {
      for (const dRow of [-1, 0, 1]) {
        for (const place of grid.get(`${column + dColumn},${row + dRow}`) ?? []) {
          if (Math.hypot(place.xy[0] - x, place.xy[1] - y) <= NEARBY_METERS) {
            mask |= place.bit;
          }
        }
      }
    }
    return mask;
  });
};

export { AMENITIES, NEARBY_METERS, amenitiesQuery, amenityIds, amenityMasks, parsePlaces };
