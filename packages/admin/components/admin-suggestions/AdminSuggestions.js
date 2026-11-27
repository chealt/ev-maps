import { connectReviewList } from "../review-list/review-list.js";

// The page is rendered on the server; this only shows it with another
// status, and approves or rejects a suggestion.
class AdminSuggestionsElement extends HTMLElement {
  connectedCallback() {
    connectReviewList(this, {
      url: "/api/admin/charger-suggestions",
      errorMessage: "adminSuggestionsNotLoaded",
    });
  }
}

customElements.define("ev-admin-suggestions", AdminSuggestionsElement);

export { AdminSuggestionsElement };
