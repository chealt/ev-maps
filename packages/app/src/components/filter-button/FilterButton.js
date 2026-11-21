import { formatNumber, message } from "../../lib/messages.js";

class FilterButtonElement extends HTMLElement {
  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("toggle-filters", { bubbles: true, composed: true }))
    );
  }

  // Shows how many filters are on: a badge on the icon, and a description
  // for screen readers. With none on, both are empty.
  showActiveCount(count) {
    const badge = this.querySelector(".badge");
    badge.hidden = count === 0;
    badge.textContent = count === 0 ? "" : formatNumber(count);
    this.querySelector("#active-filter-count").textContent =
      count === 0 ? "" : message("activeFilters", { count });
  }
}

customElements.define("ev-filter-button", FilterButtonElement);

export { FilterButtonElement };
