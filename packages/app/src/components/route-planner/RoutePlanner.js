// The From and To of a route. It only collects them: <ev-google-map> plans
// the route (route-requested) and clears it (route-cleared).
import { formatDistance } from "../../lib/distance.js";
import { message } from "../../lib/messages.js";
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";
import { isSignedIn, onSessionChange, requestSignIn } from "../../lib/session.js";
import {
  MAX_ROUTE_STOPS,
  endKey,
  readFavoriteRoutes,
  readRouteHistory,
  readSavedPlaces,
  removeSavedPlace,
  sameRoute,
  savePlace,
  toggleFavoriteRoute,
} from "../google-map/route-history.js";
import { CORRIDOR_KM, CORRIDOR_OPTIONS_KM } from "../google-map/route.js";
import { routeUrl } from "../google-map/route-url.js";

// How many filters a route was planned with, as the Filters badge counts
// them (the operator filter once).
const filterCount = (filters = {}) =>
  (filters.powerRanges?.length ?? 0) +
  (filters.connectorTypes?.length ?? 0) +
  (filters.priceLevels?.length ?? 0) +
  (filters.excludedOperators?.length ? 1 : 0) +
  (filters.onlyFavorites ? 1 : 0) +
  (filters.hideUnavailable ? 1 : 0) +
  (filters.nearby?.length ?? 0);

const GEOLOCATION_TIMEOUT_MS = 10000;
// GeolocationPositionError codes.
const LOCATION_ERRORS = { 1: "locationDenied", 2: "locationUnavailable", 3: "locationTimeout" };

class RoutePlannerElement extends HTMLElement {
  stops = [];

  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.from = this.querySelector("#route-from")?.closest("ev-place-input");
    this.to = this.querySelector("#route-to")?.closest("ev-place-input");
    this.stopsGroup = this.querySelector(".route-stops");
    this.stopList = this.querySelector(".stop-list");
    this.savePlacePanel = this.querySelector(".save-place-panel");
    this.savePlaceName = this.querySelector(".save-place-name");
    this.errorEl = this.querySelector(".error");
    this.clearButton = this.querySelector(".clear-route");

    // The hint says how far the chosen distance is.
    this.querySelector(".corridor").addEventListener("change", () => this.showCorridor());
    this.from?.addEventListener("place-change", () => this.updateSavePlaceButtons());
    this.to?.addEventListener("place-change", () => this.updateSavePlaceButtons());
    for (const button of this.querySelectorAll(".save-place-toggle")) {
      button.addEventListener("click", () => this.toggleSavePlacePanel(button.dataset.target));
    }
    for (const preset of this.querySelectorAll(".save-place-preset")) {
      preset.addEventListener("click", () => {
        this.savePlaceName.value = preset.dataset.presetLabel;
        this.selectSavePlaceIcon(preset.dataset.presetIcon);
      });
    }
    for (const iconBtn of this.querySelectorAll(".icon-option")) {
      iconBtn.addEventListener("click", () =>
        this.selectSavePlaceIcon(iconBtn.dataset.iconValue)
      );
    }
    this.querySelector(".cancel-save-place")?.addEventListener("click", () =>
      this.closeSavePlacePanel()
    );
    this.querySelector(".confirm-save-place")?.addEventListener("click", () =>
      this.confirmSavePlace()
    );

    this.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.requestRoute();
    });
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    animateEscape(this.dialog);
    this.querySelector(".use-my-location").addEventListener("click", () => this.useMyLocation());
    this.clearButton.addEventListener("click", () => {
      this.setStops([]);
      this.dialog.close();
      this.emit("route-cleared");
    });
    this.querySelector(".share-route").addEventListener("click", () => this.shareRoute());
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
    for (const control of this.querySelectorAll(
      "input, .use-my-location, .remove-stop, button[type='submit']"
    )) {
      control.disabled = !signedIn;
    }
  }

  open() {
    this.errorEl.textContent = "";
    this.closeSavePlacePanel();
    this.updateSavePlaceButtons();
    this.showSavedPlaces();
    this.showRecentRoutes();
    openDialog(this.dialog);
  }

  targetInput(target) {
    return target === "to" ? this.to : this.from;
  }

  updateSavePlaceButtons() {
    const signedIn = isSignedIn();
    for (const button of this.querySelectorAll(".save-place-toggle")) {
      const input = this.targetInput(button.dataset.target);
      const hasPlace = Boolean(signedIn && input?.place);
      button.hidden = !hasPlace;
      if (!hasPlace && this.savingTarget === button.dataset.target) {
        this.closeSavePlacePanel();
      }
    }
  }

  toggleSavePlacePanel(target) {
    if (this.savingTarget === target && !this.savePlacePanel.hidden) {
      this.closeSavePlacePanel();
      return;
    }
    const input = this.targetInput(target);
    if (!input?.place) {
      return;
    }
    this.savingTarget = target;
    this.savePlacePanel.querySelector(".save-place-value").textContent = input.place.label;
    this.savePlaceName.value = "";
    this.selectSavePlaceIcon("home");
    this.savePlacePanel.hidden = false;
    for (const button of this.querySelectorAll(".save-place-toggle")) {
      button.setAttribute("aria-expanded", String(button.dataset.target === target));
    }
    this.savePlaceName.focus();
  }

  closeSavePlacePanel() {
    this.savingTarget = null;
    if (this.savePlacePanel) {
      this.savePlacePanel.hidden = true;
    }
    for (const button of this.querySelectorAll(".save-place-toggle")) {
      button.setAttribute("aria-expanded", "false");
    }
  }

  selectSavePlaceIcon(iconId) {
    for (const button of this.querySelectorAll(".icon-option")) {
      button.setAttribute("aria-pressed", String(button.dataset.iconValue === iconId));
    }
  }

  async confirmSavePlace() {
    const input = this.targetInput(this.savingTarget);
    const name = this.savePlaceName?.value.trim();
    if (!input?.place || !name) {
      return;
    }
    const icon =
      this.querySelector('.icon-option[aria-pressed="true"]')?.dataset.iconValue ?? "home";
    const { label, place, location } = input.place;
    const saved = place?.id
      ? { name, icon, label, placeId: place.id }
      : { name, icon, label, location };
    this.closeSavePlacePanel();
    await savePlace(saved);
    await this.showSavedPlaces();
  }

  async showSavedPlaces() {
    const places = isSignedIn() ? await readSavedPlaces() : [];
    const template = this.querySelector(".saved-place-chip-template");
    for (const container of this.querySelectorAll(".saved-place-chips")) {
      const target = container.dataset.target;
      container.hidden = places.length === 0;
      container.replaceChildren(
        ...places.map((saved) => {
          const item = template.content.firstElementChild.cloneNode(true);
          const chip = item.querySelector(".saved-place-chip");
          const iconEl = item.querySelector(`.chip-icon[data-icon="${saved.icon}"]`);
          if (iconEl) {
            iconEl.hidden = false;
          }
          item.querySelector(".chip-name").textContent = saved.name;
          chip.title = saved.label;
          chip.addEventListener("click", async () => {
            await this.applySavedPlace(target, saved);
          });
          const remove = item.querySelector(".remove-saved-place");
          remove.setAttribute("aria-label", message("removeSavedPlace", { name: saved.name }));
          remove.addEventListener("click", async () => {
            await removeSavedPlace(saved);
            await this.showSavedPlaces();
          });
          return item;
        })
      );
    }
  }

  async applySavedPlace(target, saved) {
    const input = this.targetInput(target);
    if (!input) {
      return;
    }
    if (saved.placeId) {
      const { Place } = await input.placesLibrary();
      input.setPlace({ label: saved.label, place: new Place({ id: saved.placeId }) });
    } else {
      input.setPlace({ label: saved.label, location: saved.location });
    }
  }

  // Lists the favorite routes, then the others planned before, signed in;
  // choosing one asks <ev-google-map> to plan it again with its filters
  // (route-from-history), and its heart saves or removes it. `focusRoute`:
  // after a heart was pressed, its route's heart keeps the focus, in
  // whichever list it moved to.
  async showRecentRoutes(focusRoute = null) {
    const [favorites, history] = isSignedIn()
      ? await Promise.all([readFavoriteRoutes(), readRouteHistory()])
      : [[], []];
    const others = history.filter((route) => !favorites.some((saved) => sameRoute(saved, route)));
    this.fillRoutes(this.querySelector(".favorite-routes"), favorites, true);
    this.fillRoutes(this.querySelector(".recent-routes.history"), others, false);
    if (focusRoute) {
      const items = [...this.querySelectorAll(".route-item")];
      items
        .find((item) => sameRoute(item.route, focusRoute))
        ?.querySelector(".favorite-route")
        .focus();
    }
  }

  fillRoutes(section, routes, favorite) {
    section.hidden = routes.length === 0;
    const template = this.querySelector(".recent-route-template");
    section.querySelector(".recent-route-list").replaceChildren(
      ...routes.map((route) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.route = route;
        const ends = [
          route.origin.label,
          ...(route.stops ?? []).map((stop) => stop.label),
          route.destination.label,
        ].reduce((from, to) => message("routeEnds", { from, to }));
        item.querySelector(".route-ends").textContent = ends;
        const count = filterCount(route.filters);
        // With the filters and the distance it was planned with (routes
        // saved before it could be chosen: the default).
        item.querySelector(".route-filters").textContent = [
          count ? message("activeFilters", { count }) : message("noFiltersOn"),
          message("withinDistance", {
            distance: formatDistance((route.corridorKm ?? CORRIDOR_KM) * 1000),
          }),
        ].join(" · ");
        item.querySelector(".recent-route").addEventListener("click", () => {
          this.dialog.close();
          this.emit("route-from-history", route);
        });
        const heart = item.querySelector(".favorite-route");
        heart.setAttribute("aria-pressed", String(favorite));
        heart.setAttribute(
          "aria-label",
          message(favorite ? "removeFavoriteRoute" : "saveFavoriteRoute", { route: ends })
        );
        heart.addEventListener("click", async () => {
          await toggleFavoriteRoute(route);
          await this.showRecentRoutes(route);
        });
        return item;
      })
    );
  }

  // Called by <ev-google-map> when it restores a route after a reload.
  setPlaces(origin, destination, corridorKm = CORRIDOR_KM, stops = []) {
    this.from?.setPlace(origin);
    this.to?.setPlace(destination);
    this.corridorKm = corridorKm;
    this.setStops(stops);
  }

  setStops(stops) {
    this.stops = [...stops];
    this.renderStops();
  }

  hasStop(stop) {
    return this.stops.some((entry) => endKey(entry) === endKey(stop));
  }

  // Adds or removes a charger as a stop along the route; plans right away
  // when both ends are chosen, otherwise opens the planner to choose them.
  toggleStop(stop) {
    if (this.hasStop(stop)) {
      this.stops = this.stops.filter((entry) => endKey(entry) !== endKey(stop));
    } else if (this.stops.length < MAX_ROUTE_STOPS) {
      this.stops = [...this.stops, stop];
    }
    this.renderStops();
    if (isSignedIn() && this.from?.place && this.to?.place) {
      this.requestRoute();
    } else {
      this.open();
    }
  }

  renderStops() {
    if (!this.stopsGroup || !this.stopList) {
      return;
    }
    this.stopsGroup.hidden = this.stops.length === 0;
    const template = this.querySelector(".stop-template");
    const signedIn = isSignedIn();
    this.stopList.replaceChildren(
      ...this.stops.map((stop, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".stop-name").textContent = stop.label;
        const remove = item.querySelector(".remove-stop");
        remove.disabled = !signedIn;
        remove.setAttribute("aria-label", message("removeRouteStop", { stop: stop.label }));
        remove.addEventListener("click", () => {
          this.stops.splice(index, 1);
          this.renderStops();
        });
        return item;
      })
    );
  }

  // Called by <ev-google-map> when a route is shown or cleared.
  setRouteShown(shown) {
    this.clearButton.disabled = !shown;
    this.querySelector(".share-route").disabled = !shown;
    if (!shown) {
      this.currentRoute = null;
      this.setStops([]);
    }
  }

  // The route shown, for sharing it (a saved shape: placeId or location).
  setRoute(route) {
    this.currentRoute = route;
  }

  // Shares the route with the Web Share API; where that's not supported
  // (e.g. desktop Chrome without a share target), copies the link instead.
  async shareRoute() {
    if (!this.currentRoute) {
      return;
    }
    const url = routeUrl(this.currentRoute);
    const ends = message("routeEnds", {
      from: this.currentRoute.origin.label,
      to: this.currentRoute.destination.label,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: ends, url });
      } else {
        await navigator.clipboard.writeText(url);
        this.errorEl.textContent = message("routeShared");
      }
    } catch {
      // The user dismissed the share sheet: not an error.
    }
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
    this.emit("route-requested", {
      origin,
      destination,
      stops: [...this.stops],
      corridorKm: this.corridorKm,
    });
  }

  // How far from the route chargers are shown, in km, as chosen.
  get corridorKm() {
    const checked = this.querySelector('input[name="corridor-km"]:checked');
    return checked ? Number(checked.value) : CORRIDOR_KM;
  }

  // Chooses a distance (one saved with a route; one no longer offered, the
  // default).
  set corridorKm(km) {
    const value = CORRIDOR_OPTIONS_KM.includes(km) ? km : CORRIDOR_KM;
    const input = this.querySelector(`input[name="corridor-km"][value="${value}"]`);
    if (input) {
      input.checked = true;
      this.showCorridor();
    }
  }

  showCorridor() {
    const distance = this.querySelector(".corridor-hint .distance-text");
    if (distance) {
      distance.dataset.meters = String(this.corridorKm * 1000);
      distance.textContent = formatDistance(this.corridorKm * 1000);
    }
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
