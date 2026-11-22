import { formatNumber, message, valueLabel } from "../../lib/messages.js";
import { formatDay, renderBarChart } from "../bar-chart/bar-chart.js";

const USAGE_URL = "/api/admin/usage";

const language = () => document.documentElement.lang || "en";

const displayName = (type, code) => {
  try {
    return new Intl.DisplayNames(language(), { type }).of(code) ?? code;
  } catch {
    return code;
  }
};

// How each event's dimension reads, e.g. "hu:country" → "Hungarian, country
// page", "HU" → "Hungary".
const DIMENSION_LABELS = {
  page_view: (dimension) => {
    const [lang, kind] = dimension.split(":");
    return `${displayName("language", lang)}, ${valueLabel("pageKinds", kind)}`;
  },
  visitor_country: (dimension) => displayName("region", dimension),
  charger_opened: (dimension) => valueLabel("chargerSources", dimension),
  filter_used: (dimension) => valueLabel("filterKinds", dimension),
  sign_in_started: (dimension) => valueLabel("signInMethods", dimension),
};

class AdminUsageElement extends HTMLElement {
  connectedCallback() {
    this.querySelector(".periods").addEventListener("click", (event) => {
      const button = event.target.closest(".period");
      if (button) {
        this.load(Number(button.dataset.days));
      }
    });
    this.load(30);
  }

  async load(days) {
    for (const button of this.querySelectorAll(".period")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.days) === days));
    }
    const summary = this.querySelector(".summary");
    let stats;
    try {
      const response = await fetch(`${USAGE_URL}?days=${days}`);
      if (!response.ok) {
        throw new Error(`${USAGE_URL} failed: ${response.status}`);
      }
      stats = await response.json();
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
  }

  renderTotals({ events }) {
    for (const total of this.querySelectorAll(".total")) {
      total.querySelector(".value").textContent = formatNumber(
        events[total.dataset.event]?.total ?? 0
      );
    }
  }

  renderChart({ days, events }) {
    renderBarChart(this.querySelector(".bar-chart"), days, events.page_view?.byDay ?? {});
  }

  renderBreakdowns({ events }) {
    const template = this.querySelector(".row-template");
    for (const section of this.querySelectorAll(".breakdown")) {
      const { event } = section.dataset;
      const label = DIMENSION_LABELS[event] ?? ((dimension) => dimension);
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
