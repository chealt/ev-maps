// The translations Astro builds each language's pages with. The build fails
// if a language misses a key that English has, so no page shows English (or
// nothing) in its place.

import { en } from "./en.js";
import { hu } from "./hu.js";
import { pl } from "./pl.js";

const TRANSLATIONS = { en, hu, pl };
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

const isPlural = (value) =>
  typeof value === "object" && Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key));

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

for (const [language, translation] of Object.entries(TRANSLATIONS)) {
  const missing = missingKeys(en, translation);
  if (missing.length) {
    throw new Error(`Missing ${language} translations: ${missing.join(", ")}`);
  }
}

const translations = (language) => {
  const translation = TRANSLATIONS[language];
  if (!translation) {
    throw new Error(`No translations for the language "${language}"`);
  }
  return translation;
};

// Fills {name} placeholders, e.g. in page titles.
const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);

export { fill, translations };
