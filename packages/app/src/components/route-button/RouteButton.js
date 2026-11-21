class RouteButtonElement extends HTMLElement {
  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("open-route-planner", { bubbles: true, composed: true }))
    );
  }
}

customElements.define("ev-route-button", RouteButtonElement);

export { RouteButtonElement };
