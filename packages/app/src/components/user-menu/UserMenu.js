// Sign-in through the Worker (packages/worker/src/auth.js): the provider's
// OAuth page, then back to this page with a session cookie, which the menu
// reads on every load.
import { message } from "../../lib/messages.js";
import { requestFavorites } from "../../lib/favorites.js";
import { requestSuggestCharger } from "../suggest-charger-dialog/SuggestChargerDialog.js";
import { setSignedIn } from "../../lib/session.js";
import { track } from "../../lib/usage.js";
import {
  addPasskey,
  hasPasskey,
  sendSignInLink,
  signInWithPasskey,
  supportsPasskeys,
} from "./passkeys.js";

const SESSION_URL = "/api/auth/get-session";
const PROVIDERS_URL = "/api/sign-in-providers";
const SIGN_IN_URL = "/api/auth/sign-in/social";
const SIGN_OUT_URL = "/api/auth/sign-out";
// Counts a click on a support link (packages/worker/src/support-clicks.js).
const SUPPORT_CLICKS_URL = "/api/support-clicks";
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
    // A beacon, so the link opens in its new tab right away; only the
    // platform is sent.
    for (const link of this.querySelectorAll("[data-support]")) {
      link.addEventListener("click", () =>
        navigator.sendBeacon?.(
          SUPPORT_CLICKS_URL,
          new Blob([JSON.stringify({ platform: link.dataset.support })], {
            type: "application/json",
          })
        )
      );
    }
    this.querySelector(".sign-out").addEventListener("click", () => this.signOut());
    this.querySelector(".favorites-button").addEventListener("click", () => this.showFavorites());
    this.querySelector(".suggest-charger-button").addEventListener("click", () =>
      this.showSuggestCharger()
    );
    this.querySelector(".passkey").addEventListener("click", () => this.signInWithPasskey());
    this.querySelector(".email-sign-in").addEventListener("submit", (event) => {
      event.preventDefault();
      this.emailSignInLink();
    });
    this.querySelector(".add-passkey").addEventListener("click", () => this.addPasskey());

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
      // Passkeys and email, where the Worker offers them (and passkeys where
      // the browser can).
      for (const method of this.querySelectorAll("[data-method]")) {
        method.hidden =
          !providers.includes(method.dataset.method) ||
          (method.dataset.method === "passkey" && !supportsPasskeys());
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

  // Signed in, the menu gives way to the favorites list; signed out, the
  // button only says to sign in.
  showFavorites() {
    if (this.querySelector(".favorites-button").getAttribute("aria-disabled") === "true") {
      return;
    }
    this.menu.hidePopover();
    requestFavorites();
  }

  showSuggestCharger() {
    if (this.querySelector(".suggest-charger-button").getAttribute("aria-disabled") === "true") {
      return;
    }
    this.menu.hidePopover();
    requestSuggestCharger();
  }

  async signInWithPasskey() {
    track("sign_in_started", "passkey");
    this.errorEl.textContent = "";
    const result = await signInWithPasskey();
    if (result === "signed-in") {
      this.menu.hidePopover();
      await this.loadSession();
    } else if (result === "failed") {
      this.errorEl.textContent = message("passkeySignInFailed");
    }
  }

  // Emails a link that signs in (creating the account the first time) once
  // opened: only a verified email gets an account.
  async emailSignInLink() {
    track("sign_in_started", "email");
    this.errorEl.textContent = "";
    const sent = this.querySelector(".sign-in .sent");
    sent.textContent = "";
    const email = this.querySelector(".email-input").value.trim();
    const result = await sendSignInLink(email, {
      callbackURL: returnUrl({ failed: false }),
      errorCallbackURL: returnUrl({ failed: true }),
    });
    if (result === "sent") {
      sent.textContent = message("signInLinkSent", { email });
    } else {
      this.errorEl.textContent = message(
        result === "too-many" ? "tooManySignInEmails" : "signInFailed"
      );
    }
  }

  async addPasskey() {
    const status = this.querySelector(".passkey-status");
    status.textContent = "";
    const result = await addPasskey();
    if (result === "added") {
      this.querySelector(".passkey-setup").hidden = true;
      status.textContent = message("passkeyAdded");
    } else if (result === "failed") {
      status.textContent = message("passkeyNotAdded");
    }
  }

  // Admins (the Worker decides who: GET /api/admin/me) get a link to the
  // admin area.
  async showAdminLink() {
    const link = this.querySelector(".admin-link");
    try {
      link.hidden = !(await fetch("/api/admin/me")).ok;
    } catch {
      link.hidden = true;
    }
  }

  // Sponsors (the Worker decides who: GET /api/sponsor/me) get a badge on
  // their avatar and a thank-you in the menu.
  async showSponsor() {
    let sponsor = false;
    try {
      const response = await fetch("/api/sponsor/me");
      sponsor = response.ok && (await response.json()).sponsor === true;
    } catch {
      sponsor = false;
    }
    this.setSponsor(sponsor);
  }

  setSponsor(sponsor) {
    this.querySelector(".sponsor-badge").hidden = !sponsor;
    this.querySelector(".sponsor-thanks").hidden = !sponsor;
  }

  // Signed in without a passkey, the profile offers to add one.
  async offerPasskey() {
    const setup = this.querySelector(".passkey-setup");
    setup.hidden = !supportsPasskeys() || (await hasPasskey());
  }

  async signIn(provider) {
    track("sign_in_started", provider);
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
    this.querySelector(".account-name").textContent = message("accountOf", {
      name: displayName,
    });
    this.querySelector(".name").textContent = displayName;
    this.querySelector(".email").textContent = email ?? "";
    this.setSignedIn(true);
    this.offerPasskey();
    this.showAdminLink();
    this.showSponsor();
    this.dispatchEvent(
      new CustomEvent("sign-in", { detail: { name, email }, bubbles: true, composed: true })
    );
  }

  showSignedOut() {
    this.querySelector(".account-name").textContent = "";
    this.querySelector(".admin-link").hidden = true;
    this.setSponsor(false);
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
    this.querySelector(".favorites-button").setAttribute("aria-disabled", String(!signedIn));
    this.querySelector("#favorites-sign-in-hint").hidden = signedIn;
    this.querySelector(".suggest-charger-button").setAttribute("aria-disabled", String(!signedIn));
    this.querySelector("#suggest-charger-sign-in-hint").hidden = signedIn;
    this.querySelector(".my-suggestions-link").hidden = !signedIn;
    this.querySelector(".my-saved-places-link").hidden = !signedIn;
  }
}

customElements.define("ev-user-menu", UserMenuElement);

export { UserMenuElement };
