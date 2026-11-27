import { message } from "@ev-maps/ui/messages.js";

const FLAGS_URL = "/api/admin/charger-unavailability";

// The page is rendered on the server; this only acts on a charger's flags,
// then shows the page again, without them.
class AdminUnavailabilityElement extends HTMLElement {
  connectedCallback() {
    this.summary = this.querySelector(".summary");
    this.addEventListener("click", (event) => {
      const button = event.target.closest(".review");
      if (button) {
        this.review(button, button.closest(".charger-card").dataset.chargerId);
      }
    });
  }

  async review(button, chargerId) {
    const { action } = button.dataset;
    button.disabled = true;
    try {
      const response = await fetch(`${FLAGS_URL}/${encodeURIComponent(chargerId)}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      console.error("Could not review unavailability reports:", error);
      button.disabled = false;
      this.summary.textContent = message("adminUnavailabilityNotLoaded");
    }
  }
}

customElements.define("ev-admin-unavailability", AdminUnavailabilityElement);

export { AdminUnavailabilityElement };
