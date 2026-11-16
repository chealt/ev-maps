// Build-time data for the pages: the languages (Astro's i18n locales) and the
// countries with chargers. packages/worker exports the chargers as one
// {country}.json per country (`bun run export:chargers` at the root); without
// them the build has no country pages.

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { i18n } from "astro:config/server";

// Leave out the farthest 1% on each side, so a few misplaced chargers don't
// zoom the map out of the country.
const OUTLIER_SHARE = 0.01;

const languages = () =>
  (i18n?.locales ?? ["en"]).map((locale) => (typeof locale === "string" ? locale : locale.path));

const chargersDirectory = () => resolve(process.env.EV_MAPS_CHARGERS_DIR ?? "data/chargers");

const readCountries = async () => {
  const directory = chargersDirectory();
  const files = await readdir(directory).catch((error) => {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  return Promise.all(
    files
      .filter((file) => /^[a-z]{2}\.json$/.test(file))
      .map(async (file) => ({
        country: file.slice(0, 2),
        chargers: JSON.parse(await readFile(join(directory, file), "utf8")),
      }))
  );
};

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
