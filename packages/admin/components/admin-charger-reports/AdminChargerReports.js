import { message } from "@ev-maps/ui/messages.js";
import { fetchJson } from "@ev-maps/ui/fetch-json.js";
import { fillChargerProof } from "../charger-proof/charger-proof.js";

const REPORTS_URL = "/api/admin/charger-reports";

const STATUS_MESSAGES = {
  pending: "adminSuggestionPending",
  approved: "adminSuggestionApproved",
  rejected: "adminSuggestionRejected",
};

// A report's status as its badge's tone.
const STATUS_TONES = { pending: "warning", approved: "success", rejected: "danger" };

// A photo's alt text by what it shows.
const PHOTO_MESSAGES = { charger: "adminChargerPhoto", receipt: "adminReceiptPhoto" };

class AdminChargerReportsElement extends HTMLElement {
  connectedCallback() {
    this.statusFilter = this.querySelector(".status-filter");
    this.summary = this.querySelector(".summary");
    this.list = this.querySelector(".report-list");

    this.statusFilter.addEventListener("change", () => this.load());
    this.load();
  }

  async load() {
    const status = this.statusFilter.querySelector("input:checked")?.value ?? "";
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    let data;
    try {
      data = await fetchJson(`${REPORTS_URL}${params}`);
    } catch (error) {
      console.error("Could not load charger reports:", error);
      this.summary.textContent = message("adminReportsNotLoaded");
      this.list.replaceChildren();
      return;
    }
    const reports = data.reports ?? [];
    this.summary.textContent =
      reports.length === 0
        ? message("adminNoChargerReports")
        : message("adminChargerReportCount", { count: reports.length });
    const template = this.querySelector(".report-template");
    const photoTemplate = this.querySelector(".photo-item-template");
    this.list.replaceChildren(
      ...reports.map((report) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.querySelector(".charger-name").textContent = report.chargerName || report.chargerId;
        card.querySelector(".reported-by").textContent = message("adminReportedBy", {
          email: report.userEmail ?? "?",
          date: new Date(report.createdAt).toLocaleString(document.documentElement.lang || "en"),
        });
        const badge = card.querySelector(".status-badge");
        badge.dataset.tone = STATUS_TONES[report.status] ?? "warning";
        badge.textContent = message(STATUS_MESSAGES[report.status] ?? "adminSuggestionPending");
        fillChargerProof(card.querySelector(".charger-proof"), report);
        card.querySelector(".proof-photos").replaceChildren(
          ...report.photos.map(({ kind, url }) => {
            const item = photoTemplate.content.firstElementChild.cloneNode(true);
            const photo = item.querySelector(".proof-photo");
            photo.src = url;
            photo.alt = message(PHOTO_MESSAGES[kind] ?? "adminChargerPhoto");
            return item;
          })
        );
        card.querySelector(".actions").hidden = report.status !== "pending";
        card
          .querySelector(".approve")
          .addEventListener("click", () => this.review(report.id, "approve"));
        card
          .querySelector(".reject")
          .addEventListener("click", () => this.review(report.id, "reject"));
        return card;
      })
    );
  }

  async review(id, action) {
    try {
      const response = await fetch(`${REPORTS_URL}/${id}/${action}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      await this.load();
    } catch (error) {
      console.error("Could not review report:", error);
      this.summary.textContent = message("adminReportsNotLoaded");
    }
  }
}

customElements.define("ev-admin-charger-reports", AdminChargerReportsElement);

export { AdminChargerReportsElement };
