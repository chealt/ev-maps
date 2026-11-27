import { message, valueLabel } from "@ev-maps/ui/messages.js";
import { fetchJson } from "@ev-maps/ui/fetch-json.js";

const FLAGS_URL = "/api/admin/charger-unavailability";

class AdminUnavailabilityElement extends HTMLElement {
  connectedCallback() {
    this.summary = this.querySelector(".summary");
    this.list = this.querySelector(".charger-list");
    this.load();
  }

  async load() {
    let data;
    try {
      data = await fetchJson(FLAGS_URL);
    } catch (error) {
      console.error("Could not load unavailability reports:", error);
      this.summary.textContent = message("adminUnavailabilityNotLoaded");
      this.list.replaceChildren();
      return;
    }
    const chargers = data.chargers ?? [];
    this.summary.textContent =
      chargers.length === 0
        ? message("adminNoUnavailability")
        : message("adminUnavailabilityCount", { count: chargers.length });
    const template = this.querySelector(".charger-template");
    const photoTemplate = this.querySelector(".photo-item-template");
    const lang = document.documentElement.lang || "en";
    this.list.replaceChildren(
      ...chargers.map((charger) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.querySelector(".charger-name").textContent = charger.chargerName || charger.chargerId;
        card.querySelector(".counts").textContent = [
          message("adminUnavailabilityReporters", { count: charger.reporters }),
          message("adminUnavailabilityPhotos", { count: charger.withPhoto }),
        ].join(" · ");
        const badge = card.querySelector(".current-status");
        badge.textContent = charger.currentStatus
          ? message("adminCurrentStatus", {
              status: valueLabel("status", charger.currentStatus),
            })
          : "";
        badge.hidden = !charger.currentStatus;
        card.querySelector(".flags").replaceChildren(
          ...charger.flags.map((flag) => {
            const item = document.createElement("li");
            item.textContent = message("adminReportedBy", {
              email: flag.userEmail ?? "?",
              date: new Date(flag.createdAt).toLocaleString(lang),
            });
            return item;
          })
        );
        card.querySelector(".proof-photos").replaceChildren(
          ...charger.flags
            .filter(({ photoUrl }) => photoUrl)
            .map(({ photoUrl }) => {
              const item = photoTemplate.content.firstElementChild.cloneNode(true);
              const photo = item.querySelector(".proof-photo");
              photo.src = photoUrl;
              photo.alt = message("adminChargerPhoto");
              return item;
            })
        );
        card
          .querySelector(".confirm")
          .addEventListener("click", () => this.review(charger.chargerId, "confirm"));
        card
          .querySelector(".dismiss")
          .addEventListener("click", () => this.review(charger.chargerId, "dismiss"));
        return card;
      })
    );
  }

  async review(chargerId, action) {
    try {
      const response = await fetch(`${FLAGS_URL}/${encodeURIComponent(chargerId)}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      await this.load();
    } catch (error) {
      console.error("Could not review unavailability reports:", error);
      this.summary.textContent = message("adminUnavailabilityNotLoaded");
    }
  }
}

customElements.define("ev-admin-unavailability", AdminUnavailabilityElement);

export { AdminUnavailabilityElement };
