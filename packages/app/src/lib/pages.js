// Build-time data for the pages: the languages (Astro's i18n locales) and the
// countries with chargers. packages/worker exports the chargers as one
// {country}.json per country (`bun run export:chargers` at the root), in the
// directory the @country-chargers alias points to (astro.config.mjs); without
// them the build has no country pages.

import { i18n } from "astro:config/server";
import { chargerBounds, pageChargers } from "./page-chargers.js";

// Loaded on demand, so pages that don't need the chargers don't load them.
const countryFiles = import.meta.glob("@country-chargers/*.json", { import: "default" });

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

const countryName = (country, language) =>
  new Intl.DisplayNames([language], { type: "region" }).of(country.toUpperCase());

export { chargerBounds, countryName, languages, listCountries, pageChargers };
