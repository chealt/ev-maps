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

const languages = () =>
  (i18n?.locales ?? ["en"]).map((locale) => (typeof locale === "string" ? locale : locale.path));

// "…/hu.json" -> "hu"; other files in the directory are ignored.
const countryOf = (path) => /(?:^|\/)([a-z]{2})\.json$/.exec(path)?.[1];

const readCountries = () =>
  Promise.all(
    Object.entries(countryFiles)
      .filter(([path]) => countryOf(path))
      .map(async ([path, load]) => ({ country: countryOf(path), chargers: await load() }))
  );

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

export { chargerBounds, countryName, languages, readCountries };
