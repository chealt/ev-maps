import { connectReviewList } from "../review-list/review-list.js";

// The page is rendered on the server; this only shows it with another
// status, and approves or rejects a report.
class AdminChargerReportsElement extends HTMLElement {
  connectedCallback() {
    connectReviewList(this, {
      url: "/api/admin/charger-reports",
      errorMessage: "adminReportsNotLoaded",
    });
  }
}

customElements.define("ev-admin-charger-reports", AdminChargerReportsElement);

export { AdminChargerReportsElement };
