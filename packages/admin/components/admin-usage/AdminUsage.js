import { formatNumber, message, valueLabel } from "@ev-maps/ui/messages.js";
import { formatDay, renderBarChart } from "@ev-maps/ui/bar-chart.js";
import { dayCount } from "../day-count.js";
import { fetchJson } from "@ev-maps/ui/fetch-json.js";

const USAGE_URL = "/api/admin/usage";

const language = () => document.documentElement.lang || "en";

const displayName = (type, code) => {
  try {
    return new Intl.DisplayNames(language(), { type }).of(code) ?? code;
  } catch {
    return code;
  }
};

// How each event's dimension reads: "hu:country" → "Hungarian, country
// page", "HU" → "Hungary", or the label of the host's values table the page
// passes in data-dimension-labels, e.g. { charger_opened: "chargerSources" }.
const dimensionLabels = (element) => {
  const tables = JSON.parse(element.dataset.dimensionLabels || "{}");
  return {
    page_view: (dimension) => {
      const [lang, kind] = dimension.split(":");
      return `${displayName("language", lang)}, ${valueLabel("pageKinds", kind)}`;
    },
    visitor_country: (dimension) => displayName("region", dimension),
    ...Object.fromEntries(
      Object.entries(tables).map(([event, table]) => [
        event,
        (dimension) => valueLabel(table, dimension),
      ])
    ),
  };
};

class AdminUsageElement extends HTMLElement {
  connectedCallback() {
    this.querySelector(".periods").addEventListener("change", (event) => {
      this.load(Number(event.target.value));
    });
    this.load(30);
  }

  async load(days) {
    for (const input of this.querySelectorAll(".periods input")) {
      input.checked = Number(input.value) === days;
    }
    const summary = this.querySelector(".summary");
    let stats;
    try {
      stats = await fetchJson(`${USAGE_URL}?days=${days}`);
    } catch (error) {
      console.error("Could not load the usage stats:", error);
      summary.textContent = message("adminUsageNotLoaded");
      return;
    }
    summary.textContent = message("adminUsagePeriod", {
      from: formatDay(stats.days[0]),
      to: formatDay(stats.days.at(-1)),
    });
    this.renderTotals(stats);
    this.renderChart(stats);
    this.renderBreakdowns(stats);
    this.renderTop(stats);
  }

  // The host's top items (e.g. the most favorited), each with its count;
  // items without a saved name show their ID.
  renderTop({ top = [] }) {
    const section = this.querySelector(".top-items");
    const template = this.querySelector(".row-template");
    section.querySelector(".empty").hidden = top.length > 0;
    section.querySelector("tbody").replaceChildren(
      ...top.map(({ id, name, count }) => {
        const row = template.content.firstElementChild.cloneNode(true);
        row.querySelector(".name").textContent = name ?? id;
        row.querySelector(".count").textContent = message("adminTopCount", { count });
        return row;
      })
    );
  }

  renderTotals({ events }) {
    for (const total of this.querySelectorAll(".total")) {
      total.querySelector(".value").textContent = formatNumber(
        events[total.dataset.event]?.total ?? 0
      );
    }
  }

  renderChart({ days, events }) {
    renderBarChart(this.querySelector(".bar-chart"), days, events.page_view?.byDay ?? {}, dayCount);
  }

  renderBreakdowns({ events }) {
    const template = this.querySelector(".row-template");
    const labels = dimensionLabels(this);
    for (const section of this.querySelectorAll(".breakdown[data-event]")) {
      const { event } = section.dataset;
      const label = labels[event] ?? ((dimension) => dimension);
      const counts = Object.entries(events[event]?.byDimension ?? {});
      section.querySelector(".empty").hidden = counts.length > 0;
      section.querySelector("tbody").replaceChildren(
        ...counts.map(([dimension, count]) => {
          const row = template.content.firstElementChild.cloneNode(true);
          row.querySelector(".name").textContent = label(dimension);
          row.querySelector(".count").textContent = formatNumber(count);
          return row;
        })
      );
    }
  }
}

customElements.define("ev-admin-usage", AdminUsageElement);

export { AdminUsageElement };
