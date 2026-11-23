import { message } from "#lib/messages.js";

// Says which admin is signed in (GET /api/admin/me, which only answers
// admins).
class AdminPageElement extends HTMLElement {
  async connectedCallback() {
    const status = this.querySelector(".signed-in-as");
    try {
      const response = await fetch("/api/admin/me");
      if (response.ok) {
        const { email } = await response.json();
        status.textContent = message("adminSignedInAs", { email });
        return;
      }
    } catch (error) {
      console.error("Could not load the admin:", error);
    }
    status.textContent = message("adminSignedOut");
  }
}

customElements.define("ev-admin-page", AdminPageElement);

export { AdminPageElement };
