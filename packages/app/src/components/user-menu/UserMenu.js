// Sign-in through the Worker (packages/worker/src/auth.js): the provider's
// OAuth page, then back to this page with a session cookie, which the menu
// reads on every load.
import { message } from "../../lib/messages.js";
import { setSignedIn } from "../../lib/session.js";

const SESSION_URL = "/api/auth/get-session";
const PROVIDERS_URL = "/api/sign-in-providers";
const SIGN_IN_URL = "/api/auth/sign-in/social";
const SIGN_OUT_URL = "/api/auth/sign-out";
// Added to the page's URL when sign-in fails, so the menu can say so.
const SIGN_IN_ERROR_PARAM = "sign-in-error";

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const postJson = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// This page, to come back to after signing in, with or without the error.
const returnUrl = ({ failed }) => {
  const url = new URL(window.location.href);
  url.searchParams.delete(SIGN_IN_ERROR_PARAM);
  if (failed) {
    url.searchParams.set(SIGN_IN_ERROR_PARAM, "");
  }
  return `${url.pathname}${url.search}`;
};

class UserMenuElement extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector(".menu-button");
    this.menu = this.querySelector(".account-menu");
    this.errorEl = this.querySelector(".sign-in .error");

    this.menu.addEventListener("toggle", (event) =>
      this.button.setAttribute("aria-expanded", String(event.newState === "open"))
    );
    for (const provider of this.querySelectorAll("[data-provider]")) {
      provider.addEventListener("click", () => this.signIn(provider.dataset.provider));
    }
    this.querySelector(".sign-out").addEventListener("click", () => this.signOut());

    this.showReturnedError();
    this.loadSession();
    this.loadProviders();
  }

  // The page lists every provider, hidden; the Worker says which have
  // credentials. Without an answer (e.g. offline, or the Worker is down),
  // none is offered: signing in couldn't work anyway.
  async loadProviders() {
    try {
      const response = await fetch(PROVIDERS_URL);
      if (!response.ok) {
        return;
      }
      const { providers } = await response.json();
      for (const button of this.querySelectorAll("[data-provider]")) {
        button.hidden = !providers.includes(button.dataset.provider);
      }
      this.querySelector(".sign-in").classList.toggle("unavailable", providers.length === 0);
    } catch (error) {
      console.error("Could not load the sign-in providers:", error);
    }
  }

  // Offline or without the API, the menu shows signed out.
  async loadSession() {
    try {
      const response = await fetch(SESSION_URL);
      const session = response.ok ? await response.json() : null;
      if (session?.user) {
        this.showUser(session.user);
        return;
      }
    } catch (error) {
      console.error("Could not load the session:", error);
    }
    this.showSignedOut();
  }

  async signIn(provider) {
    this.errorEl.textContent = "";
    try {
      const response = await postJson(SIGN_IN_URL, {
        provider,
        callbackURL: returnUrl({ failed: false }),
        errorCallbackURL: returnUrl({ failed: true }),
      });
      const { url } = response.ok ? await response.json() : {};
      if (!url) {
        throw new Error(`Sign-in request failed: ${response.status}`);
      }
      window.location.assign(url);
    } catch (error) {
      console.error(error);
      this.errorEl.textContent = message("signInFailed");
    }
  }

  async signOut() {
    try {
      await postJson(SIGN_OUT_URL, {});
    } catch (error) {
      console.error("Could not sign out:", error);
      return;
    }
    this.menu.hidePopover();
    this.showSignedOut();
    this.dispatchEvent(new CustomEvent("sign-out", { bubbles: true, composed: true }));
  }

  // Coming back from a failed sign-in: say so in the open menu, and drop the
  // marker from the URL so a reload doesn't repeat it.
  showReturnedError() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SIGN_IN_ERROR_PARAM)) {
      return;
    }
    window.history.replaceState(null, "", returnUrl({ failed: false }));
    this.errorEl.textContent = message("signInFailed");
    this.menu.showPopover();
  }

  showUser({ name, email, image }) {
    const displayName = name || email;
    const picture = this.querySelector(".picture");
    picture.hidden = !image;
    picture.src = image ?? "";
    this.querySelector(".initials").textContent = image ? "" : initialsOf(displayName);
    this.button.setAttribute("aria-label", message("accountOf", { name: displayName }));
    this.querySelector(".name").textContent = displayName;
    this.querySelector(".email").textContent = email ?? "";
    this.setSignedIn(true);
    this.dispatchEvent(
      new CustomEvent("sign-in", { detail: { name, email }, bubbles: true, composed: true })
    );
  }

  showSignedOut() {
    this.button.removeAttribute("aria-label");
    this.setSignedIn(false);
  }

  setSignedIn(signedIn) {
    setSignedIn(signedIn);
    this.button.removeAttribute("aria-busy");
    this.querySelector(".loading").hidden = true;
    this.querySelector(".sign-in-label").hidden = signedIn;
    this.querySelector(".avatar").hidden = !signedIn;
    this.querySelector(".profile").hidden = !signedIn;
    this.querySelector(".sign-in").hidden = signedIn;
    this.querySelector(".sign-out").hidden = !signedIn;
  }
}

customElements.define("ev-user-menu", UserMenuElement);

export { UserMenuElement };
