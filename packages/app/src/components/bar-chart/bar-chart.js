import { message } from "../../lib/messages.js";

const language = () => document.documentElement.lang || "en";

// "2026-11-24" → "Nov 24", in the page's language.
const formatDay = (day) =>
  new Intl.DateTimeFormat(language(), { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`)
  );

// Fills in a BarChart.astro: a bar per day in `days`, as tall as its count in
// `byDay` ({ day: count }, days without one count 0) relative to the busiest.
const renderBarChart = (chart, days, byDay) => {
  const max = Math.max(1, ...days.map((day) => byDay[day] ?? 0));
  const template = chart.querySelector(".bar-template");
  chart.querySelector(".chart").replaceChildren(
    ...days.map((day) => {
      const count = byDay[day] ?? 0;
      const bar = template.content.firstElementChild.cloneNode(true);
      const text = message("adminDayCount", { day: formatDay(day), count });
      bar.style.setProperty("--share", String(count / max));
      bar.title = text;
      bar.querySelector(".label").textContent = text;
      return bar;
    })
  );
  chart.querySelector(".chart-range .from").textContent = formatDay(days[0]);
  chart.querySelector(".chart-range .to").textContent = formatDay(days.at(-1));
};

export { formatDay, renderBarChart };
