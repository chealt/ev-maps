// What a user can say about a charger's availability and price, and the
// proof that comes with it, checked the same way for a report about a
// charger (src/charger-reports.js) and a suggestion of a new one
// (src/charger-suggestions.js).

import { FREE_COST } from "./charger-values.js";

const PHOTO_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

// Status IDs (src/charger-values.js) a user can report.
const AVAILABILITIES = [
  "operational",
  "partly-operational",
  "temporarily-unavailable",
  "not-operational",
  "removed",
];
const CURRENCIES = ["EUR", "GBP", "PLN", "HUF", "CZK", "RON", "CHF", "SEK", "NOK", "DKK", "USD"];
const PRICE_UNITS = ["kwh", "minute", "session"];
// How a price reads in `usage_cost`, the way the sources write theirs (and
// the app's priciness reads "/kWh" prices).
const UNIT_TEXT = { kwh: "kWh", minute: "min", session: "session" };

const decodedBytes = (base64) => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

// A photo as a data URL, of at most `maxBytes` once decoded.
const isPhoto = (value, maxBytes) => {
  const match = typeof value === "string" ? value.match(PHOTO_PATTERN) : null;
  if (!match) {
    return false;
  }
  const bytes = decodedBytes(match[2]);
  return bytes > 0 && bytes <= maxBytes;
};

const isLocation = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const isAvailability = (value) => AVAILABILITIES.includes(value);

const isPrice = (price) =>
  typeof price === "object" &&
  price !== null &&
  (price.free === true ||
    (Number.isFinite(price.amount) &&
      price.amount > 0 &&
      price.amount <= 100_000 &&
      CURRENCIES.includes(price.currency) &&
      PRICE_UNITS.includes(price.unit)));

// Where the device was: { lat, lng, accuracy } (accuracy in meters, from
// the Geolocation API).
const isDeviceLocation = (value) =>
  typeof value === "object" &&
  value !== null &&
  isLocation(value.lat, value.lng) &&
  (value.accuracy === undefined || (Number.isFinite(value.accuracy) && value.accuracy >= 0));

// Just the price's fields.
const cleanPrice = (price) =>
  price.free === true
    ? { free: true }
    : { amount: price.amount, currency: price.currency, unit: price.unit };

// The price as `usage_cost` text, e.g. "EUR 0.45/kWh", or "Free".
const costText = (price) =>
  price.free === true
    ? FREE_COST
    : `${price.currency} ${price.amount}/${UNIT_TEXT[price.unit] ?? price.unit}`;

export {
  AVAILABILITIES,
  CURRENCIES,
  PHOTO_PATTERN,
  PRICE_UNITS,
  cleanPrice,
  costText,
  isAvailability,
  isDeviceLocation,
  isLocation,
  isPhoto,
  isPrice,
};
