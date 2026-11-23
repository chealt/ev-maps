// Server-side message formatting, for Astro components: the same templates
// the browser's messages.js fills at runtime (plural form for values.count,
// numbers formatted for the language).

// Fills {name} placeholders, e.g. in page titles.
const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);

// A message rendered on the server, like messages.js's in the browser: the
// plural form for values.count, and numbers formatted for the language.
const formatMessage = (language, entry, values = {}) => {
  const template =
    typeof entry === "object"
      ? (entry[new Intl.PluralRules(language).select(values.count)] ?? entry.other)
      : entry;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => {
    const value = values[name];
    if (value === undefined) {
      return placeholder;
    }
    return typeof value === "number"
      ? new Intl.NumberFormat(language).format(value)
      : String(value);
  });
};

export { fill, formatMessage };
