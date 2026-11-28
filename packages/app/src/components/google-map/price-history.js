// The charger details' price history (#463): the charger's usual price over
// the last 30 days, how the price now compares, the hours and days it's much
// cheaper or pricier, and its average price by hour of the day. From the
// Worker's hourly history (packages/worker/src/charger-prices.js), for
// signed-in users, as live availability.

import { message } from "../../lib/messages.js";
import {
  formatDays,
  formatHour,
  formatHourRanges,
  formatPrice,
  percentFromUsual,
} from "../../lib/price-history.js";

// Sources the Worker gathers prices of (PRICE_SOURCES in charger-prices.js).
const PRICE_SOURCES = ["eipa"];

const priceHistoryIds = (charger) =>
  (charger.ids ?? [charger.id]).filter((id) => PRICE_SOURCES.includes(id.split(":")[0]));

// The charger's history, or null without one (or signed out).
const fetchPriceHistory = async (ids) => {
  const response = await fetch(`/api/chargers/prices?ids=${ids.map(encodeURIComponent).join(",")}`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()).history ?? null;
};

const highlightsOf = (lang, history) => {
  const highlights = [];
  if (history.cheapHours.length) {
    highlights.push({
      level: "lower",
      text: message("priceCheaperAt", { hours: formatHourRanges(lang, history.cheapHours) }),
    });
  }
  if (history.expensiveHours.length) {
    highlights.push({
      level: "higher",
      text: message("pricePricierAt", { hours: formatHourRanges(lang, history.expensiveHours) }),
    });
  }
  if (history.cheapDays.length) {
    highlights.push({
      level: "lower",
      text: message("priceCheaperOn", { days: formatDays(lang, history.cheapDays) }),
    });
  }
  if (history.expensiveDays.length) {
    highlights.push({
      level: "higher",
      text: message("pricePricierOn", { days: formatDays(lang, history.expensiveDays) }),
    });
  }
  return highlights;
};

const levelOf = (value, usual) => {
  if (value === null) {
    return "none";
  }
  if (value >= usual * 1.1) {
    return "higher";
  }
  return value <= usual * 0.9 ? "lower" : "usual";
};

const renderChart = (section, lang, history) => {
  const chart = section.querySelector(".price-chart");
  const bars = chart.querySelector(".price-bars");
  bars.replaceChildren();
  chart.hidden = !history.byHour;
  if (!history.byHour) {
    return;
  }
  const max = Math.max(...history.byHour.filter((value) => value !== null));
  for (const [hour, value] of history.byHour.entries()) {
    const bar = document.createElement("li");
    bar.className = "price-bar";
    bar.dataset.level = levelOf(value, history.usual);
    bar.style.setProperty("--share", value === null || !max ? 0 : value / max);
    const text =
      value === null
        ? `${formatHour(lang, hour)}: –`
        : `${formatHour(lang, hour)}: ${formatPrice(lang, value, history.unit)}`;
    bar.title = text;
    const label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = text;
    bar.append(label);
    bars.append(bar);
  }
};

// Fills in the section, hidden while there's no history; `isCurrent()` says
// the same charger is still open once the history loads.
const showPriceHistory = async (section, charger, { signedIn, isCurrent }) => {
  section.hidden = true;
  const ids = priceHistoryIds(charger);
  if (!signedIn || !ids.length) {
    return;
  }
  let history;
  try {
    history = await fetchPriceHistory(ids);
  } catch (error) {
    console.error("Could not load the charger's price history:", error);
    return;
  }
  if (!history || !isCurrent()) {
    return;
  }
  const lang = document.documentElement.lang || "en";
  section.querySelector(".price-usual").textContent = message("priceUsual", {
    price: formatPrice(lang, history.usual, history.unit),
  });
  section.querySelector(".price-range").textContent =
    history.min === history.max
      ? message("priceSteady")
      : message("priceRange", {
          min: formatPrice(lang, history.min, history.unit),
          max: formatPrice(lang, history.max, history.unit),
        });
  const now = section.querySelector(".price-now");
  now.hidden = history.current === null;
  now.dataset.level = history.currentLevel ?? "usual";
  if (history.current !== null) {
    const price = formatPrice(lang, history.current, history.unit);
    const percent = percentFromUsual(history);
    now.textContent =
      history.currentLevel === "higher"
        ? message("priceNowHigher", { price, percent })
        : history.currentLevel === "lower"
          ? message("priceNowLower", { price, percent })
          : message("priceNowUsual", { price });
  }
  const list = section.querySelector(".price-highlights");
  list.replaceChildren(
    ...highlightsOf(lang, history).map(({ level, text }) => {
      const item = document.createElement("li");
      item.dataset.level = level;
      item.textContent = text;
      return item;
    })
  );
  list.hidden = list.children.length === 0;
  section.querySelector(".price-not-enough").hidden = Boolean(history.byHour);
  renderChart(section, lang, history);
  section.hidden = false;
};

export { priceHistoryIds, showPriceHistory };
