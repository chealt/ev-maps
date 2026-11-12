import { loadGoogleIdentity } from "../google-map/loader.js";

const decodeJwtPayload = (token) => {
  const base64 = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

// The theme the page currently shows: the user's choice, or the system's.
const isDarkTheme = () => {
  const { theme } = document.documentElement.dataset;
  return theme ? theme === "dark" : systemDarkQuery.matches;
};

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

class UserMenuElement extends HTMLElement {
  renderSignInButton = () => {
    const container = this.querySelector(".google-signin-button");
    if (!this.accounts || !container) {
      return;
    }
    // Google draws the button in an iframe once, so a theme change redraws it.
    container.replaceChildren();
    this.accounts.id.renderButton(container, {
      theme: isDarkTheme() ? "filled_black" : "outline",
      size: "large",
      type: "standard",
      shape: "pill",
    });
  };

  connectedCallback() {
    this.signedOutEl = this.querySelector(".signed-out");
    this.signedInEl = this.querySelector(".signed-in");
    this.menuEl = this.querySelector(".account-menu");

    this.querySelector(".sign-out")?.addEventListener("click", () => this.signOut());
    this.menuEl?.addEventListener("toggle", (event) =>
      this.querySelector(".avatar").setAttribute("aria-expanded", String(event.newState === "open"))
    );

    document.addEventListener("theme-change", this.renderSignInButton);
    systemDarkQuery.addEventListener("change", this.renderSignInButton);

    loadGoogleIdentity()
      .then((accounts) => this.initializeGoogleSignIn(accounts))
      .catch((error) => console.error(error));
  }

  disconnectedCallback() {
    document.removeEventListener("theme-change", this.renderSignInButton);
    systemDarkQuery.removeEventListener("change", this.renderSignInButton);
  }

  initializeGoogleSignIn(accounts) {
    if (!accounts?.id) {
      return;
    }
    this.accounts = accounts;
    accounts.id.initialize({
      client_id: this.dataset.clientId,
      callback: (response) => this.handleCredential(response),
      auto_select: false,
      cancel_on_tap_outside: false,
    });
    this.renderSignInButton();
  }

  handleCredential({ credential }) {
    try {
      const { name, email, picture } = decodeJwtPayload(credential);
      this.showUser({ name: name || email, email, picture });
      this.dispatchEvent(
        new CustomEvent("google-sign-in", {
          detail: { name, email, credential },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Invalid Google Sign-In response:", error);
    }
  }

  showUser({ name, email, picture }) {
    const pictureEl = this.querySelector(".picture");
    pictureEl.hidden = !picture;
    pictureEl.src = picture ?? "";
    this.querySelector(".initials").textContent = picture ? "" : initialsOf(name);
    this.querySelector(".avatar").setAttribute("aria-label", `Account: ${name}`);
    this.querySelector(".name").textContent = name;
    this.querySelector(".email").textContent = email ?? "";

    this.signedOutEl.hidden = true;
    this.signedInEl.hidden = false;
  }

  signOut() {
    this.menuEl?.hidePopover();
    this.accounts?.id.disableAutoSelect?.();
    this.signedInEl.hidden = true;
    this.signedOutEl.hidden = false;
    this.dispatchEvent(new CustomEvent("google-sign-out", { bubbles: true, composed: true }));
  }
}

customElements.define("ev-user-menu", UserMenuElement);

export { UserMenuElement };
