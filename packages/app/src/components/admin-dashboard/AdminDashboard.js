import { message } from "../../lib/messages.js";
import { renderBarChart } from "../bar-chart/bar-chart.js";

const DASHBOARD_URL = "/api/admin/dashboard";

class AdminDashboardElement extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  async load() {
    let stats;
    try {
      const response = await fetch(DASHBOARD_URL);
      if (!response.ok) {
        throw new Error(`${DASHBOARD_URL} failed: ${response.status}`);
      }
      stats = await response.json();
    } catch (error) {
      console.error("Could not load the dashboard:", error);
      this.querySelector(".not-loaded").hidden = false;
      return;
    }
    for (const card of this.querySelectorAll(".card")) {
      const byDay = stats[card.dataset.key] ?? {};
      const total = Object.values(byDay).reduce((sum, count) => sum + count, 0);
      renderBarChart(card.querySelector(".bar-chart"), stats.days, byDay);
      card.querySelector(".total").textContent = message("adminTotal", { count: total });
    }
  }
}

customElements.define("ev-admin-dashboard", AdminDashboardElement);

export { AdminDashboardElement };
