// The From and To of a route. It only collects them: <ev-google-map> plans
// the route (route-requested) and clears it (route-cleared).
import { message } from "../../lib/messages.js";
import { isSignedIn, onSessionChange, requestSignIn } from "../../lib/session.js";
import { readRouteHistory } from "../google-map/route-history.js";

// How many filters a route was planned with, as the Filters badge counts
// them (the operator filter once).
const filterCount = (filters = {}) =>
  (filters.powerRanges?.length ?? 0) +
  (filters.connectorTypes?.length ?? 0) +
  (filters.excludedOperators?.length ? 1 : 0) +
  (filters.onlyFavorites ? 1 : 0) +
  (filters.hideUnavailable ? 1 : 0) +
  (filters.nearby?.length ?? 0);

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
    this.showRecentRoutes();
    this.dialog.showModal();
  }

  // Lists the routes planned before, signed in; choosing one asks
  // <ev-google-map> to plan it again with its filters (route-from-history).
  async showRecentRoutes() {
    const section = this.querySelector(".recent-routes");
    const routes = isSignedIn() ? await readRouteHistory() : [];
    section.hidden = routes.length === 0;
    const template = this.querySelector(".recent-route-template");
    this.querySelector(".recent-route-list").replaceChildren(
      ...routes.map((route) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".route-ends").textContent = message("routeEnds", {
          from: route.origin.label,
          to: route.destination.label,
        });
        const count = filterCount(route.filters);
        item.querySelector(".route-filters").textContent = count
          ? message("activeFilters", { count })
          : message("noFiltersOn");
        item.querySelector(".recent-route").addEventListener("click", () => {
          this.dialog.close();
          this.emit("route-from-history", route);
        });
        return item;
      })
    );
  }

  // Called by <ev-google-map> when it restores a route after a reload.
  setPlaces(origin, destination) {
    this.from?.setPlace(origin);
    this.to?.setPlace(destination);
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

  // A route to `destination` ({ label, location }), e.g. a charger's
  // Navigate: planned right away from where the user is when they're signed
  // in and already allow their location; otherwise the planner opens with
  // the destination filled in, to choose where from (or to sign in).
  async planTo(destination) {
    this.to.setPlace(destination);
    const permission = await navigator.permissions
      ?.query({ name: "geolocation" })
      .catch(() => null);
    if (!isSignedIn() || permission?.state !== "granted" || !navigator.geolocation) {
      this.open();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.from.setPlace({
          label: message("myLocation"),
          location: { lat: coords.latitude, lng: coords.longitude },
        });
        this.requestRoute();
      },
      () => this.open(),
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    );
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
