// Runtime messages in the page's language. Astro renders the language's
// message templates and value labels into the page (Layout.astro), so the
// scripts hold no copy: they pick a template and fill in the numbers.

const language = () => document.documentElement.lang || "en";

let cached;
const translations = () => {
  cached ??= JSON.parse(document.getElementById("messages")?.textContent || "{}");
  return cached;
};

const formatNumber = (value, options) => new Intl.NumberFormat(language(), options).format(value);

// A message with its {placeholders} filled in; numbers are formatted for the
// language. Messages with a count have a template per plural category.
const message = (key, values = {}) => {
  const entry = translations().messages?.[key];
  const template =
    typeof entry === "object"
      ? (entry[new Intl.PluralRules(language()).select(values.count)] ?? entry.other)
      : entry;
  if (template === undefined) {
    console.error(`Missing message: ${key}`);
    return "";
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => {
    const value = values[name];
    if (value === undefined) {
      return placeholder;
    }
    return typeof value === "number" ? formatNumber(value) : String(value);
  });
};

// The label for an ID in the charger data, e.g. the status "operational";
// values without a label (such as connector names) are shown as they are.
const valueLabel = (table, value) => translations().values?.[table]?.[value] ?? value;

const freeLabel = () => translations().values?.free;

export { formatNumber, freeLabel, message, valueLabel };
