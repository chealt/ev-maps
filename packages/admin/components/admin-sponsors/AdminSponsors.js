// The page is rendered on the server; choosing another period shows it with
// that ?days=.
class AdminSponsorsElement extends HTMLElement {
  connectedCallback() {
    this.querySelector(".periods").addEventListener("change", (event) => {
      const url = new URL(window.location.href);
      url.searchParams.set("days", event.target.value);
      window.location.assign(url);
    });
  }
}

customElements.define("ev-admin-sponsors", AdminSponsorsElement);

export { AdminSponsorsElement };
