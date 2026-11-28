// Formats a charger's price history (packages/worker's charger-prices.js)
// for the charger details: prices with their unit, hours of the day and days
// of the week, in the page's language.

// A Monday, for the weekdays' names (0 is Monday, as the Worker counts).
const MONDAY = Date.UTC(2026, 10, 2);

// 2.49 and "PLN/kWh" -> "2.49 PLN/kWh".
const formatPrice = (lang, value, unit) =>
  `${new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${unit}`;

const formatHour = (lang, hour) =>
  new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour % 24)));

// [{ from: 22, to: 6 }] -> "22:00–06:00".
const formatHourRanges = (lang, ranges) =>
  new Intl.ListFormat(lang, { type: "conjunction" }).format(
    ranges.map(({ from, to }) => `${formatHour(lang, from)}–${formatHour(lang, to)}`)
  );

const weekdayName = (lang, day) =>
  new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(
    new Date(MONDAY + day * 24 * 60 * 60 * 1000)
  );

// [5, 6] -> "Saturday and Sunday".
const formatDays = (lang, days) =>
  new Intl.ListFormat(lang, { type: "conjunction" }).format(
    days.map((day) => weekdayName(lang, day))
  );

// How far the current price is from the usual one, in whole percent.
const percentFromUsual = ({ current, usual }) =>
  usual ? Math.round((Math.abs(current - usual) / usual) * 100) : 0;

export { formatDays, formatHour, formatHourRanges, formatPrice, percentFromUsual, weekdayName };
