import { message, valueLabel } from "@ev-maps/ui/messages.js";

const SUGGESTIONS_URL = "/api/admin/charger-suggestions";

const STATUS_MESSAGES = {
  pending: "adminSuggestionPending",
  approved: "adminSuggestionApproved",
  rejected: "adminSuggestionRejected",
};

// A suggestion's status as its badge's tone.
const STATUS_TONES = { pending: "warning", approved: "success", rejected: "danger" };

class AdminSuggestionsElement extends HTMLElement {
  connectedCallback() {
    this.statusFilter = this.querySelector(".status-filter");
    this.summary = this.querySelector(".summary");
    this.list = this.querySelector(".suggestion-list");

    this.statusFilter.addEventListener("change", () => this.load());
    this.load();
  }

  async load() {
    const status = this.statusFilter.querySelector("input:checked")?.value ?? "";
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    let data;
    try {
      const response = await fetch(`${SUGGESTIONS_URL}${params}`);
      if (!response.ok) {
        throw new Error(`${SUGGESTIONS_URL} failed: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("Could not load charger suggestions:", error);
      this.summary.textContent = message("adminSuggestionsNotLoaded");
      this.list.replaceChildren();
      return;
    }
    const suggestions = data.suggestions ?? [];
    this.summary.textContent =
      suggestions.length === 0
        ? message("adminNoSuggestions")
        : message("adminSuggestionCount", { count: suggestions.length });
    const template = this.querySelector(".suggestion-template");
    const connectorTemplate = this.querySelector(".connector-item-template");
    this.list.replaceChildren(
      ...suggestions.map((suggestion) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.querySelector(".charger-name").textContent = suggestion.name;
        card.querySelector(".charger-meta").textContent = [suggestion.operator, suggestion.address]
          .filter(Boolean)
          .join(" · ");
        const badge = card.querySelector(".status-badge");
        badge.dataset.tone = STATUS_TONES[suggestion.status] ?? "warning";
        badge.textContent = message(STATUS_MESSAGES[suggestion.status] ?? "adminSuggestionPending");
        card.querySelector(".coordinates").textContent =
          `${suggestion.location.lat}, ${suggestion.location.lng}`;
        const submittedBy = card.querySelector(".submitted-by");
        if (suggestion.userEmail) {
          submittedBy.textContent = message("adminSuggestedBy", { email: suggestion.userEmail });
        } else {
          submittedBy.hidden = true;
        }
        card.querySelector(".connectors").replaceChildren(
          ...(suggestion.connectors ?? []).map(({ type, powerKw, quantity }) => {
            const item = connectorTemplate.content.firstElementChild.cloneNode(true);
            item.textContent = message("connectorWithPower", {
              type: valueLabel("connectors", type) ?? type,
              quantity: quantity ?? 1,
              power: powerKw,
            });
            return item;
          })
        );
        const photoUrls =
          suggestion.photoUrls ?? [suggestion.photoUrl ?? suggestion.photo].filter(Boolean);
        const photoTemplate = this.querySelector(".photo-item-template");
        card.querySelector(".proof-photos").replaceChildren(
          ...photoUrls.map((url) => {
            const item = photoTemplate.content.firstElementChild.cloneNode(true);
            item.querySelector(".proof-photo").src = url;
            return item;
          })
        );
        const actions = card.querySelector(".actions");
        actions.hidden = suggestion.status !== "pending";
        card
          .querySelector(".approve")
          .addEventListener("click", () => this.review(suggestion.id, "approve"));
        card
          .querySelector(".reject")
          .addEventListener("click", () => this.review(suggestion.id, "reject"));
        return card;
      })
    );
  }

  async review(id, action) {
    try {
      const response = await fetch(`${SUGGESTIONS_URL}/${id}/${action}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      await this.load();
    } catch (error) {
      console.error("Could not review suggestion:", error);
      this.summary.textContent = message("adminSuggestionsNotLoaded");
    }
  }
}

customElements.define("ev-admin-suggestions", AdminSuggestionsElement);

export { AdminSuggestionsElement };
