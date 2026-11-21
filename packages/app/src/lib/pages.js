// Build-time data for the pages: the languages (Astro's i18n locales) and the
// countries with chargers. packages/worker exports the chargers as one
// {country}.json per country (`bun run export:chargers` at the root), in the
// directory the @country-chargers alias points to (astro.config.mjs); without
// them the build has no country pages.

import { i18n } from "astro:config/server";

// Loaded on demand, so pages that don't need the chargers don't load them.
const countryFiles = import.meta.glob("@country-chargers/*.json", { import: "default" });

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

const languages = () =>
  (i18n?.locales ?? ["en"]).map((locale) => (typeof locale === "string" ? locale : locale.path));

// "…/hu.json" -> "hu"; other files in the directory are ignored.
const countryOf = (path) => /(?:^|\/)([a-z]{2})\.json$/.exec(path)?.[1];

// The countries with chargers, each with a function loading its chargers:
// listing the pages loads none, and each page only its own (the files can be
// hundreds of MB together, too much for the dev server to load per request).
const listCountries = () =>
  Object.entries(countryFiles)
    .filter(([path]) => countryOf(path))
    .map(([path, load]) => ({ country: countryOf(path), loadChargers: load }));

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

const countryName = (country, language) =>
  new Intl.DisplayNames([language], { type: "region" }).of(country.toUpperCase());

export { chargerBounds, countryName, languages, listCountries, pageChargers };
