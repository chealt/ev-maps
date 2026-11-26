import { renderBarChart } from "@ev-maps/ui/bar-chart.js";
import { dayCount } from "../day-count.js";
import { formatNumber, message } from "@ev-maps/ui/messages.js";
import { fetchJson } from "@ev-maps/ui/fetch-json.js";

const DASHBOARD_URL = "/api/admin/dashboard";

class AdminDashboardElement extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  async load() {
    let stats;
    try {
      stats = await fetchJson(DASHBOARD_URL);
    } catch (error) {
      console.error("Could not load the dashboard:", error);
      this.querySelector(".not-loaded").hidden = false;
      return;
    }
    for (const card of this.querySelectorAll(".card[data-key]")) {
      const byDay = stats[card.dataset.key] ?? {};
      const total = Object.values(byDay).reduce((sum, count) => sum + count, 0);
      renderBarChart(card.querySelector(".bar-chart"), stats.days, byDay, dayCount);
      card.querySelector(".total").textContent = message("adminTotal", { count: total });
    }
    this.renderTopPages(stats.topPages ?? []);
  }

  renderTopPages(pages) {
    const card = this.querySelector(".top-pages");
    const template = this.querySelector(".page-template");
    const max = Math.max(1, ...pages.map(({ count }) => count));
    card.querySelector(".empty").hidden = pages.length > 0;
    card.querySelector(".pages").replaceChildren(
      ...pages.map(({ path, count }) => {
        const item = template.content.firstElementChild.cloneNode(true);
        const link = item.querySelector(".path");
        link.href = path;
        link.textContent = path;
        item.querySelector(".count").textContent = formatNumber(count);
        item.style.setProperty("--share", String(count / max));
        return item;
      })
    );
  }
}

customElements.define("ev-admin-dashboard", AdminDashboardElement);

export { AdminDashboardElement };
