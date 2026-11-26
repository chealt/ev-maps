import { message, valueLabel } from "../../lib/messages.js";

const SUGGESTIONS_URL = "/api/charger-suggestions";

const STATUS_MESSAGES = {
  pending: "suggestionPending",
  approved: "suggestionApproved",
  rejected: "suggestionRejected",
};

// A suggestion's status as its badge's tone.
const STATUS_TONES = { pending: "warning", approved: "success", rejected: "danger" };

class UserSuggestionsElement extends HTMLElement {
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
      if (response.status === 401) {
        this.summary.textContent = message("signInForMySuggestions");
        this.list.replaceChildren();
        return;
      }
      if (!response.ok) {
        throw new Error(`${SUGGESTIONS_URL} failed: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("Could not load user charger suggestions:", error);
      this.summary.textContent = message("mySuggestionsNotLoaded");
      this.list.replaceChildren();
      return;
    }
    const suggestions = data.suggestions ?? [];
    this.summary.textContent =
      suggestions.length === 0
        ? message("noMySuggestions")
        : message("mySuggestionCount", { count: suggestions.length });
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
        badge.textContent = message(STATUS_MESSAGES[suggestion.status] ?? "suggestionPending");
        card.querySelector(".coordinates").textContent =
          `${suggestion.location.lat}, ${suggestion.location.lng}`;
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
        const photoUrls = suggestion.photoUrls ?? [suggestion.photoUrl].filter(Boolean);
        const photoTemplate = this.querySelector(".photo-item-template");
        card.querySelector(".proof-photos").replaceChildren(
          ...photoUrls.map((url) => {
            const item = photoTemplate.content.firstElementChild.cloneNode(true);
            item.querySelector(".proof-photo").src = url;
            return item;
          })
        );
        return card;
      })
    );
  }
}

customElements.define("ev-user-suggestions", UserSuggestionsElement);

export { UserSuggestionsElement };
