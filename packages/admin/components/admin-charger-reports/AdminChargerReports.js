import { message } from "@ev-maps/ui/messages.js";

const REPORTS_URL = "/api/admin/charger-reports";

// The page is rendered on the server; this only shows it with another
// status, and approves or rejects a report, then shows the page again.
class AdminChargerReportsElement extends HTMLElement {
  connectedCallback() {
    this.summary = this.querySelector(".summary");
    this.querySelector(".status-filter").addEventListener("change", (event) => {
      const url = new URL(window.location.href);
      url.searchParams.set("status", event.target.value);
      window.location.assign(url);
    });
    this.addEventListener("click", (event) => {
      const button = event.target.closest(".review");
      if (button) {
        this.review(button, button.closest(".report-card").dataset.reportId);
      }
    });
  }

  async review(button, id) {
    button.disabled = true;
    try {
      const response = await fetch(`${REPORTS_URL}/${id}/${button.dataset.action}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      console.error("Could not review report:", error);
      button.disabled = false;
      this.summary.textContent = message("adminReportsNotLoaded");
    }
  }
}

customElements.define("ev-admin-charger-reports", AdminChargerReportsElement);

export { AdminChargerReportsElement };
