// The site's copy, used only at build time: Astro renders the pages with it,
// and bakes each page's runtime messages into its HTML. The client loads no
// i18n. (The Worker's sign-in email has its own text: packages/worker's
// src/email.js.) One folder per language, one file per section of the
// site, so work on one part doesn't touch the others' files:
//
// - common: used on more than one kind of page, or by the layout
// - map: the map (filters, charger details, the charger list, routes)
// - account: the account menu (sign-in, theme, language, favorites)
// - legal: the privacy policy and terms of use
// - admin: the admin area's frame (navigation, overview); each admin page
//   has its own section, e.g. admin-errors, admin-usage
//
// Each section has the same parts:
// - page: rendered by Astro at build time
// - messages: templates the scripts fill in at runtime (src/lib/messages.js);
//   {name} is a placeholder, and messages with a count have a form for each
//   plural category of the language (Intl.PluralRules)
// - values: labels for IDs, e.g. in the charger data (packages/worker's
//   charger-values.js)
//
// Astro gets every section (`translations`); a page's scripts only get the
// messages and values of the sections it uses (`runtimeTranslations`, see
// Layout.astro). The build fails if a language misses a key that English
// has, so no page shows English (or nothing) in its place.

import { sections as cs } from "./cs/index.js";
import { sections as en } from "./en/index.js";
import { sections as hu } from "./hu/index.js";
import { sections as fr } from "./fr/index.js";
import { sections as pl } from "./pl/index.js";
import { sections as es } from "./es/index.js";
import { sections as de } from "./de/index.js";
import { sections as sk } from "./sk/index.js";

const SECTIONS = { en, hu, pl, es, de, fr, sk, cs };
// Which sections each kind of page's scripts need.
const PAGE_SECTIONS = {
  map: ["common", "map", "account"],
  legal: ["common", "legal"],
  admin: [
    "common",
    "admin",
    "admin-charger-reports",
    "admin-dashboard",
    "admin-errors",
    "admin-performance",
    "admin-reports",
    "admin-suggestions",
    "admin-unavailability",
    "admin-usage",
  ],
};
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

const isPlural = (value) =>
  typeof value === "object" &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key));

// Plural messages need `other`; their other forms depend on the language.
const missingKeys = (reference, translation, path = []) =>
  Object.entries(reference).flatMap(([key, value]) => {
    const translated = translation?.[key];
    const keyPath = [...path, key];
    if (translated === undefined) {
      return [keyPath.join(".")];
    }
    if (isPlural(value)) {
      return translated.other === undefined ? [`${keyPath.join(".")}.other`] : [];
    }
    return typeof value === "object" ? missingKeys(value, translated, keyPath) : [];
  });

for (const [language, sections] of Object.entries(SECTIONS)) {
  const missing = Object.entries(SECTIONS.en).flatMap(([name, section]) =>
    missingKeys(section, sections[name], [name])
  );
  if (missing.length) {
    throw new Error(`Missing ${language} translations: ${missing.join(", ")}`);
  }
}

// A translation starts with a capital letter where English does, so a label
// isn't the odd one out in a row of buttons (#332). Where English starts
// with a name, the translation may start mid-sentence.
const STARTS_WITH_A_NAME = new Set([
  "map.page.openStreetMapCredit.link",
  "admin-reports.page.adminReportsDescription",
]);
const capitalized = (text) => /^\p{Lu}/u.test(text);
const startsWithALetter = (text) => /^\p{L}/u.test(text);

const lowercaseKeys = (reference, translation, path = []) =>
  Object.entries(reference).flatMap(([key, value]) => {
    const translated = translation?.[key];
    const keyPath = [...path, key];
    if (typeof value === "object") {
      return lowercaseKeys(value, translated, keyPath);
    }
    const lowercase =
      typeof value === "string" &&
      typeof translated === "string" &&
      startsWithALetter(value) &&
      startsWithALetter(translated) &&
      capitalized(value) &&
      !capitalized(translated) &&
      !STARTS_WITH_A_NAME.has(keyPath.join("."));
    return lowercase ? [keyPath.join(".")] : [];
  });

for (const [language, sections] of Object.entries(SECTIONS)) {
  const lowercase = Object.entries(SECTIONS.en).flatMap(([name, section]) =>
    lowercaseKeys(section, sections[name], [name])
  );
  if (lowercase.length) {
    throw new Error(
      `${language} translations start lowercase where English is capitalized: ${lowercase.join(", ")}`
    );
  }
}

// The sections put together: { languageName, page, messages, values }.
const merge = (sections) => ({
  languageName: sections[0]?.languageName,
  page: Object.assign({}, ...sections.map((section) => section.page)),
  messages: Object.assign({}, ...sections.map((section) => section.messages)),
  values: Object.assign({}, ...sections.map((section) => section.values)),
});

const sectionsOf = (language) => {
  const sections = SECTIONS[language];
  if (!sections) {
    throw new Error(`No translations for the language "${language}"`);
  }
  return sections;
};

const merged = new Map();

// Everything in a language, for Astro.
const translations = (language) => {
  if (!merged.has(language)) {
    merged.set(language, merge(Object.values(sectionsOf(language))));
  }
  return merged.get(language);
};

// The messages and values a kind of page's scripts use ("map", "legal",
// "admin").
const runtimeTranslations = (language, pageKind) => {
  const names = PAGE_SECTIONS[pageKind];
  if (!names) {
    throw new Error(`No sections for the kind of page "${pageKind}"`);
  }
  const { messages, values } = merge(names.map((name) => sectionsOf(language)[name]));
  return { messages, values };
};

const LANGUAGES = Object.keys(SECTIONS);

export { LANGUAGES, runtimeTranslations, translations };
export { fill, formatMessage } from "@ev-maps/ui/format.js";
