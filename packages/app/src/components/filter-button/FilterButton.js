class FilterButtonElement extends HTMLElement {
  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("toggle-filters", { bubbles: true, composed: true }))
    );
  }
}

customElements.define("ev-filter-button", FilterButtonElement);

export { FilterButtonElement };
