// What a country page holds of its country's chargers, and where its map
// starts: pure functions of the chargers, used at build time by pages.js
// (and unit tested in page-chargers.test.js).

// Leave out the farthest 1% on each side, so a few misplaced chargers don't
// zoom the map out of the country.
const OUTLIER_SHARE = 0.01;
// The most chargers a country page holds: about 1.5 MB of HTML (150 KB
// compressed). Larger countries get an even spread of them; zoomed in, the
// map loads every charger from the API. Cloudflare serves files up to 25 MiB,
// and the US alone has over 85,000 chargers. The tests set a smaller limit.
const MAX_PAGE_CHARGERS = Number(process.env.EV_MAPS_MAX_PAGE_CHARGERS) || 4000;
// The first grid for the spread, about 5 km, coarsened by GRID_GROWTH until
// few enough cells are left.
const START_CELL_DEGREES = 0.05;
const GRID_GROWTH = 1.25;

// One charger per grid cell, the fastest, with the grid coarsened until there
// are at most `max`: an even spread over the country for the map's overview.
const spreadChargers = (chargers, max) => {
  for (let cell = START_CELL_DEGREES; ; cell *= GRID_GROWTH) {
    const fastestByCell = new Map();
    for (const charger of chargers) {
      const key = `${Math.floor(charger.location.lat / cell)},${Math.floor(charger.location.lng / cell)}`;
      const kept = fastestByCell.get(key);
      if (!kept || (charger.maxPowerKw ?? 0) > (kept.maxPowerKw ?? 0)) {
        fastestByCell.set(key, charger);
      }
    }
    if (fastestByCell.size <= max) {
      return [...fastestByCell.values()];
    }
  }
};

// The chargers a country page holds, and whether that's only some of them.
const pageChargers = (chargers) =>
  chargers.length <= MAX_PAGE_CHARGERS
    ? { chargers, truncated: false }
    : { chargers: spreadChargers(chargers, MAX_PAGE_CHARGERS), truncated: true };

const quantile = (sorted, share) => sorted[Math.round(share * (sorted.length - 1))];

// The area the map shows first: where the country's chargers are.
const chargerBounds = (chargers) => {
  const lats = chargers.map((charger) => charger.location.lat).sort((a, b) => a - b);
  const lngs = chargers.map((charger) => charger.location.lng).sort((a, b) => a - b);
  return {
    north: quantile(lats, 1 - OUTLIER_SHARE),
    south: quantile(lats, OUTLIER_SHARE),
    east: quantile(lngs, 1 - OUTLIER_SHARE),
    west: quantile(lngs, OUTLIER_SHARE),
  };
};

export { chargerBounds, pageChargers, spreadChargers };
