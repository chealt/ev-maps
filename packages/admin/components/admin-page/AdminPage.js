import { message } from "@ev-maps/ui/messages.js";

const NAV_KEY = "ev-maps:admin-nav";

// Says which admin is signed in (GET /api/admin/me, which only answers
// admins), and collapses the side navigation to its icons, or expands it,
// remembered on this device.
class AdminPageElement extends HTMLElement {
  connectedCallback() {
    this.collapseButton = this.querySelector(".collapse-nav");
    this.collapseButton.setAttribute("aria-pressed", String(this.collapsed));
    this.collapseButton.addEventListener("click", () => this.setCollapsed(!this.collapsed));
    this.showAdmin();
  }

  get collapsed() {
    return document.documentElement.dataset.adminNav === "collapsed";
  }

  setCollapsed(collapsed) {
    if (collapsed) {
      document.documentElement.dataset.adminNav = "collapsed";
    } else {
      delete document.documentElement.dataset.adminNav;
    }
    this.collapseButton.setAttribute("aria-pressed", String(collapsed));
    try {
      if (collapsed) {
        localStorage.setItem(NAV_KEY, "collapsed");
      } else {
        localStorage.removeItem(NAV_KEY);
      }
    } catch {
      // Storage can be unavailable; it's collapsed until the next page.
    }
  }

  async showAdmin() {
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
