// The page is rendered on the server; picking a branch sends its form, which
// shows the page with that ?branch=.
class AdminReportsElement extends HTMLElement {
  connectedCallback() {
    const form = this.querySelector(".branch-form");
    form.querySelector(".branch-select").addEventListener("change", () => form.requestSubmit());
  }
}

customElements.define("ev-admin-reports", AdminReportsElement);

export { AdminReportsElement };
