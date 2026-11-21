// The From and To of a route. It only collects them: <ev-google-map> plans
// the route (route-requested) and clears it (route-cleared).
import { message } from "../../lib/messages.js";
import { isSignedIn, onSessionChange, requestSignIn } from "../../lib/session.js";

const GEOLOCATION_TIMEOUT_MS = 10000;
// GeolocationPositionError codes.
const LOCATION_ERRORS = { 1: "locationDenied", 2: "locationUnavailable", 3: "locationTimeout" };

class RoutePlannerElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.from = this.querySelector("#route-from")?.closest("ev-place-input");
    this.to = this.querySelector("#route-to")?.closest("ev-place-input");
    this.errorEl = this.querySelector(".error");
    this.clearButton = this.querySelector(".clear-route");

    this.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.requestRoute();
    });
    this.querySelector(".close").addEventListener("click", () => this.dialog.close());
    this.querySelector(".use-my-location").addEventListener("click", () => this.useMyLocation());
    this.clearButton.addEventListener("click", () => {
      this.dialog.close();
      this.emit("route-cleared");
    });
    this.querySelector(".sign-in-button").addEventListener("click", () => {
      this.dialog.close();
      requestSignIn();
    });
    this.showSignedIn(isSignedIn());
    onSessionChange((signedIn) => this.showSignedIn(signedIn));
  }

  // Planning routes needs a signed-in user (the Worker's route API does).
  // Signed out, the fields stay visible but disabled, with a sign-in button.
  showSignedIn(signedIn) {
    this.querySelector(".sign-in-needed").hidden = signedIn;
    for (const control of this.querySelectorAll("input, .use-my-location, button[type='submit']")) {
      control.disabled = !signedIn;
    }
  }

  open() {
    this.errorEl.textContent = "";
    this.dialog.showModal();
  }

  // Called by <ev-google-map> when a route is shown or cleared.
  setRouteShown(shown) {
    this.clearButton.disabled = !shown;
  }

  requestRoute() {
    const origin = this.from.place;
    const destination = this.to.place;
    if (!origin || !destination) {
      this.errorEl.textContent = message("choosePlaces");
      return;
    }
    this.errorEl.textContent = "";
    this.dialog.close();
    this.emit("route-requested", { origin, destination });
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      this.errorEl.textContent = message("locationUnsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        this.from.setPlace({
          label: message("myLocation"),
          location: { lat: coords.latitude, lng: coords.longitude },
        }),
      (error) => {
        this.errorEl.textContent = message(LOCATION_ERRORS[error.code] ?? "locationFailed");
      },
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define("ev-route-planner", RoutePlannerElement);

export { RoutePlannerElement };
