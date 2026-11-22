import Supercluster from "supercluster";
import { fetchChargersInBounds } from "./chargers.js";
import { chargerName } from "../../lib/charger-name.js";
import { distanceInMeters, formatDistance } from "../../lib/distance.js";
import { addFavorite, isFavorite, onFavoritesChange, removeFavorite } from "../../lib/favorites.js";
import { setMapCenter } from "../../lib/map-center.js";
import { track } from "../../lib/usage.js";
import { formatNumber, freeLabel, message, valueLabel } from "../../lib/messages.js";
import { isSignedIn, onSessionChange, requestSignIn } from "../../lib/session.js";
import { fetchAccountSettings, saveAccountSettings } from "../../lib/account-settings.js";
import { loadGoogleMaps } from "./loader.js";
import { fetchChargersAlongRoute, pathBounds, toLatLng } from "./route.js";
import { readFilters, readMapView, saveFilters, saveMapView } from "./saved-state.js";

// Signed in, filters are saved to the account this long after the last change.
const ACCOUNT_SAVE_DELAY = 1000;

// Chargers closer than this many pixels are grouped; above the max zoom never.
const CLUSTER_RADIUS = 60;
const CLUSTER_MAX_ZOOM = 16;
// Google Maps tiles are 256px, so the radius is in screen pixels.
const CLUSTER_EXTENT = 256;
const CLUSTER_SIZES = [
  { minCount: 100, size: "large" },
  { minCount: 10, size: "medium" },
];
// Google Maps color schemes for the themes set by ThemePicker on <html>.
const COLOR_SCHEMES = { system: "FOLLOW_SYSTEM", light: "LIGHT", dark: "DARK" };

const currentColorScheme = () =>
  COLOR_SCHEMES[document.documentElement.dataset.theme] ?? COLOR_SCHEMES.system;

const formatConnector = ({ type, powerKw, quantity }) =>
  message(powerKw ? "connectorWithPower" : "connector", {
    type: valueLabel("connectors", type),
    quantity: quantity ?? 1,
    power: powerKw,
  });

const formatDetails = ({ operator, access, usageCost, free, status, numberOfPoints }) => {
  const cost = free ? freeLabel() : usageCost;
  return [
    operator && message("operator", { value: operator }),
    access && message("access", { value: valueLabel("access", access) }),
    cost && message("cost", { value: cost }),
    status && message("status", { value: valueLabel("status", status) }),
    numberOfPoints && message("chargingPoints", { count: numberOfPoints }),
  ].filter(Boolean);
};

// Sources the Worker has live statuses for (packages/worker/src/live-status.js).
const LIVE_STATUS_SOURCES = ["eipa", "irve"];
// The page keeps statuses this long, in memory only; the Worker refreshes
// them every few minutes.
const STATUS_MAX_AGE_MS = 60 * 1000;
// The Worker's batch size for statuses (MAX_IDS in live-status.js).
const STATUS_BATCH_SIZE = 100;
// Signed in, the pins' availability is refreshed this often while the page
// is visible (the Worker refreshes statuses every 5 to 15 minutes).
const PIN_STATUS_REFRESH_MS = 2 * 60 * 1000;

const minutesAgo = (timestamp) =>
  new Intl.RelativeTimeFormat(document.documentElement.lang, { numeric: "auto" }).format(
    -Math.max(0, Math.round((Date.now() - timestamp) / 60000)),
    "minute"
  );

// Space around a route when the map fits it, in pixels.
const ROUTE_PADDING = 48;
const ROUTE_LINE = { strokeOpacity: 0.85, strokeWeight: 5 };

// A chosen place, as the Routes library takes it: a Google Place, or a location.
const routeEndpoint = ({ place, location }) => place ?? location;

const LIST_ZOOM = 15;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs a DOM update as a view transition where supported and wanted.
const withViewTransition = (update) => {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
};

const boundsCenter = ({ north, south, east, west }) => ({
  lat: (north + south) / 2,
  lng: (east + west) / 2,
});

const isInBounds = ({ lat, lng }, { north, south, east, west }) =>
  lat >= south && lat <= north && lng >= west && lng <= east;

const toFeature = (charger) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [charger.location.lng, charger.location.lat] },
  properties: { charger },
});

const chargerCountMessage = ({ shown, total, filtered, truncated, alongRoute }) => {
  if (!total) {
    return message(alongRoute ? "noRouteChargers" : "noChargers");
  }
  if (filtered) {
    return message(alongRoute ? "routeChargersFiltered" : "chargersFiltered", {
      shown,
      count: total,
    });
  }
  if (alongRoute) {
    return message("routeChargersFound", { count: total });
  }
  if (truncated) {
    return message("chargersTruncated", { count: total });
  }
  return message("chargersFound", { count: total });
};

// The active power filter buttons' ranges: [minKw, maxKw).
const readActivePowerRanges = (panel) =>
  [...panel.querySelectorAll('.power-filter[aria-pressed="true"]')].map((button) => ({
    minKw: Number(button.dataset.minKw),
    maxKw: button.dataset.maxKw ? Number(button.dataset.maxKw) : Infinity,
  }));

// The charger's IDs at sources with live statuses.
const liveStatusIds = (charger) =>
  (charger.ids ?? [charger.id]).filter((id) => LIVE_STATUS_SOURCES.includes(id.split(":")[0]));

// True if the statuses say none of the points is free; null without any.
const noneFree = (statuses) => {
  if (!statuses.length) {
    return null;
  }
  const sum = (field) => statuses.reduce((total, status) => total + status[field], 0);
  return sum("total") > 0 && sum("available") === 0;
};

// The connector IDs of the active connector type buttons.
const readActiveConnectorTypes = (panel) =>
  new Set(
    [...panel.querySelectorAll('.connector-filter[aria-pressed="true"]')].flatMap((button) =>
      button.dataset.connectorTypes.split(",")
    )
  );

// A charger's operator as the operator filter knows it; "" is unknown.
const operatorOf = (charger) => charger.operator?.trim() ?? "";

// How many of the chargers each operator has: most first, then by name, the
// unknown operator last. The `kept` operators are listed even without
// chargers, e.g. ones turned off, so they can be turned back on.
const countOperators = (chargers, kept) => {
  const counts = new Map([...kept].map((operator) => [operator, 0]));
  for (const charger of chargers) {
    const operator = operatorOf(charger);
    counts.set(operator, (counts.get(operator) ?? 0) + 1);
  }
  return [...counts].sort(
    ([nameA, countA], [nameB, countB]) =>
      countB - countA || (nameA === "") - (nameB === "") || nameA.localeCompare(nameB)
  );
};

// With no connector type active, every charger matches; otherwise it needs a
// connector of one of the active types.
const matchesConnectors = (charger, types) =>
  types.size === 0 || charger.connectors.some((connector) => types.has(connector.type));

// With no range active, every charger matches, including those without power
// data; otherwise its fastest connector must be in one of the active ranges.
const matchesPower = (charger, ranges) => {
  if (!ranges.length) {
    return true;
  }
  const power = charger.maxPowerKw;
  return power != null && ranges.some((range) => power >= range.minKw && power < range.maxKw);
};

class GoogleMapElement extends HTMLElement {
  map = null;
  maps = null;
  markersById = new Map();
  statuses = new Map();
  // The charger each charger pin (not cluster) is for.
  chargersByMarker = new Map();
  searchId = 0;
  mapReady = new Promise((resolve) => {
    this.resolveMapReady = resolve;
  });

  handleThemeChange = () => this.recreateMap();

  connectedCallback() {
    // Operators the user turned off; every other operator is on.
    this.excludedOperators = new Set();
    this.statusButton = this.querySelector(".map-status");
    this.statusEl = this.statusButton?.querySelector(".text");
    this.chargerList = this.querySelector(".charger-list");
    this.mapEl = this.querySelector(".google-map");
    this.filterPanel = this.querySelector(".filter-dialog");
    this.detailsPanel = this.querySelector(".charger-details");
    this.pageChargers = this.readPageChargers();
    this.routePlanner = this.querySelector("ev-route-planner");
    this.clearRouteButton = this.querySelector(".map-controls .clear-route");

    this.setupEventListeners();
    this.filtersRestored = this.restoreFilters();

    const apiKey = this.dataset.apiKey;
    if (!apiKey) {
      return;
    }

    // Caches Open Charge Map responses; see public/sw.js.
    navigator.serviceWorker?.register("/sw.js").catch((error) => console.error(error));

    this.loadMap(apiKey);
  }

  // Google Maps can't be cached, so offline the map waits for a connection.
  loadMap(apiKey) {
    loadGoogleMaps(apiKey)
      .then((maps) => this.initMap(maps))
      .catch((error) => {
        console.error(error);
        if (navigator.onLine) {
          this.setStatus(message("mapFailed"), "error");
        } else {
          this.setStatus(message("offlineMap"));
          window.addEventListener("online", () => this.loadMap(apiKey), { once: true });
        }
      });
  }

  disconnectedCallback() {
    document.removeEventListener("theme-change", this.handleThemeChange);
    clearInterval(this.pinStatusTimer);
  }

  get locatedZoom() {
    return Number(this.dataset.locatedZoom) || 14;
  }

  get minChargerZoom() {
    return Number(this.dataset.minChargerZoom) || 9;
  }

  // A country page has its chargers in the page, built with the site.
  readPageChargers() {
    const data = this.querySelector(".page-chargers")?.textContent;
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Invalid page chargers:", error);
      return null;
    }
  }

  // A large country's page has an even spread of its chargers, not all.
  get pageChargersTruncated() {
    return this.hasAttribute("data-page-chargers-truncated");
  }

  get chargerBounds() {
    return this.dataset.chargerBounds ? JSON.parse(this.dataset.chargerBounds) : null;
  }

  setupEventListeners() {
    this.addEventListener("locate-start", () => {
      track("locate_me");
      this.setStatus(message("locating"), "loading");
    });
    this.addEventListener("location-found", (event) => this.handleLocationFound(event));
    this.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || message("locationFailed"), "error")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());
    this.addEventListener("open-route-planner", () => this.routePlanner?.open());
    this.addEventListener("route-requested", (event) => this.showRoute(event.detail));
    this.addEventListener("route-cleared", () => this.clearRoute());
    this.clearRouteButton?.addEventListener("click", () => this.clearRoute());
    this.statusButton?.addEventListener("click", () => this.openChargerList());
    this.chargerList
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.closeChargerList());
    // Escape closes the dialog without a transition, so close it with one.
    this.chargerList?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.closeChargerList();
    });
    this.chargerList?.querySelector(".items")?.addEventListener("click", (event) => {
      const entry = event.target.closest(".entry");
      if (entry) {
        this.showChargerFromList(this.sortedChargers[Number(entry.dataset.index)].charger);
      }
    });
    document.addEventListener("theme-change", this.handleThemeChange);
    this.showFilterSyncSignedIn(isSignedIn());
    // The session may have loaded before the map did.
    if (isSignedIn()) {
      this.syncAccountFilters();
    }
    // Signed in, pins turn red while none of their charger's points is free.
    this.pinStatusTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        this.showPinAvailability();
      }
    }, PIN_STATUS_REFRESH_MS);
    this.showFavoritesSignedIn(isSignedIn());
    onSessionChange((signedIn) => {
      if (!signedIn) {
        this.statuses.clear();
      }
      this.showPinAvailability();
      this.showFavoritesSignedIn(signedIn);
      this.showFilterSyncSignedIn(signedIn);
      if (signedIn) {
        this.syncAccountFilters();
      }
    });
    // Live availability needs a signed-in user; show it once there is one.
    onSessionChange(() => {
      if (this.activeCharger && !this.detailsPanel?.hidden) {
        this.showAvailability(this.activeCharger);
      }
    });
    this.detailsPanel
      ?.querySelector(".availability .sign-in-button")
      ?.addEventListener("click", () => requestSignIn());

    this.detailsPanel
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.hideChargerDetails());
    this.detailsPanel
      ?.querySelector(".favorite-button")
      ?.addEventListener("click", () => this.toggleFavorite());
    // A charger picked in the favorites list.
    document.addEventListener("show-charger", (event) =>
      this.showFavoriteCharger(event.detail.charger)
    );
    onFavoritesChange(() => {
      this.showFavoriteState();
      for (const marker of this.chargersByMarker.keys()) {
        this.showMarkerAvailability(marker);
      }
      if (this.onlyFavorites()) {
        this.showMatchingChargers();
      }
    });
    this.filterPanel?.addEventListener("click", (event) => this.handleFilterClick(event));
    this.filterPanel?.addEventListener("change", (event) => this.handleOperatorChange(event));
    for (const button of this.querySelectorAll(".clear-filters")) {
      button.addEventListener("click", () => this.clearFilters());
    }
    for (const button of this.filterPanel?.querySelectorAll(".close, .done") ?? []) {
      button.addEventListener("click", () => this.filterPanel.close());
    }
    // However the dialog closes (buttons, Escape), the Filters button follows.
    this.filterPanel?.addEventListener("close", () => {
      this.querySelector(".filter-button")?.setAttribute("aria-expanded", "false");
      // Operators kept in place while the dialog was open can go now.
      this.listOperators(this.loaded?.chargers ?? []);
      this.flushAccountSave();
    });
    // Leaving the page doesn't lose a save that's waiting.
    window.addEventListener("pagehide", () => this.flushAccountSave());
  }

  setStatus(message, state = "idle") {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusButton.dataset.state = state;
    }
  }

  async initMap(maps) {
    // Offline, the map can't fetch its Map ID configuration (needed for
    // markers) or tiles, and wouldn't recover, so wait for a connection.
    if (!navigator.onLine) {
      this.setStatus(message("offlineMap"));
      window.addEventListener("online", () => this.initMap(maps), { once: true });
      return;
    }
    const { Map } = await maps.importLibrary("maps");
    this.maps = maps;
    this.MapClass = Map;
    const savedView = await readMapView();
    // Without a saved view, a country page starts on the country.
    const countryBounds = savedView ? null : this.chargerBounds;
    this.createMap({
      center:
        savedView?.center ??
        (countryBounds
          ? boundsCenter(countryBounds)
          : {
              lat: Number(this.dataset.centerLat) || 0,
              lng: Number(this.dataset.centerLng) || 0,
            }),
      zoom: savedView?.zoom ?? (savedView ? this.locatedZoom : Number(this.dataset.zoom) || 12),
    });
    if (countryBounds) {
      this.map.fitBounds(countryBounds, 0);
    }
    this.resolveMapReady();

    // A saved view is where the user left the map, so don't move it.
    if (!savedView) {
      this.querySelector("ev-locate-button[data-auto-locate]")?.locateIfPermitted();
    }
  }

  createMap({ center, zoom }) {
    this.map = new this.MapClass(this.mapEl, {
      center,
      zoom,
      colorScheme: currentColorScheme(),
      mapId: this.dataset.mapId || "DEMO_MAP_ID",
      gestureHandling: "greedy",
      clickableIcons: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      cameraControl: false,
    });
    // "idle" fires once the map has finished moving or zooming. The first one
    // is just the initial render, which isn't a view the user chose.
    let rendered = false;
    this.map.addListener("idle", () => {
      if (rendered) {
        saveMapView({ center: this.map.getCenter().toJSON(), zoom: this.map.getZoom() });
      }
      rendered = true;
      this.loadEvChargers();
    });
  }

  // Google Maps only accepts a color scheme when a map is created, so a theme
  // change replaces the map at the same position and moves the markers over.
  recreateMap() {
    if (!this.map) {
      return;
    }
    const center = this.map.getCenter().toJSON();
    const zoom = this.map.getZoom();
    this.mapEl.replaceChildren();
    this.createMap({ center, zoom });
    this.route?.line.setMap(this.map);
    for (const marker of this.markersById.values()) {
      marker.map = this.map;
    }
  }

  async handleLocationFound(event) {
    const { lat, lng } = event.detail;
    this.userLocation = { lat, lng };
    const coordinate = (value) =>
      formatNumber(value, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    this.setStatus(message("location", { lat: coordinate(lat), lng: coordinate(lng) }));

    await this.mapReady;
    this.map.setCenter({ lat, lng });
    this.map.setZoom(this.locatedZoom);
  }

  toggleFilters() {
    if (!this.filterPanel || this.filterPanel.open) {
      return;
    }
    this.filterPanel.showModal();
    this.querySelector(".filter-button")?.setAttribute("aria-expanded", "true");
  }

  handleFilterClick(event) {
    if (event.target.closest(".sync-sign-in-button")) {
      this.filterPanel.close();
      requestSignIn();
      return;
    }
    if (event.target.closest(".show-all-operators")) {
      this.excludedOperators.clear();
      this.showOperatorChoices();
      this.filtersChanged();
      return;
    }
    const signedInFilter = event.target.closest(".favorites-filter, .nearby-filter");
    if (signedInFilter?.getAttribute("aria-disabled") === "true") {
      this.filterPanel.close();
      requestSignIn();
      return;
    }
    const button = event.target.closest(
      ".power-filter, .connector-filter, .favorites-filter, .nearby-filter"
    );
    if (!button) {
      return;
    }
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    if (button.getAttribute("aria-pressed") === "true") {
      // Which kind of filter: "power", "connector", "favorites", "nearby".
      track("filter_used", button.className.match(/\b(\w+)-filter\b/)?.[1] ?? "other");
    }
    this.filtersChanged();
  }

  handleOperatorChange(event) {
    const checkbox = event.target.closest(".operator-filter");
    if (!checkbox) {
      return;
    }
    const { operator } = checkbox.dataset;
    if (checkbox.checked) {
      this.excludedOperators.delete(operator);
    } else {
      this.excludedOperators.add(operator);
      track("filter_used", "operator");
    }
    this.showOperatorChoices();
    this.filtersChanged();
  }

  clearFilters() {
    for (const button of this.querySelectorAll(
      ".power-filter, .connector-filter, .favorites-filter, .nearby-filter"
    )) {
      button.setAttribute("aria-pressed", "false");
    }
    this.excludedOperators.clear();
    this.showOperatorChoices();
    this.filtersChanged();
  }

  // Lists the operators of the loaded chargers, each ticked unless it's
  // turned off. The list is only rebuilt when the operators change, and
  // while the dialog is open none is removed, so ticking one keeps it, and
  // the focus, in place.
  listOperators(chargers) {
    const list = this.filterPanel?.querySelector(".operator-options");
    if (!list) {
      return;
    }
    const kept = new Set(this.excludedOperators);
    if (this.filterPanel.open) {
      for (const checkbox of list.querySelectorAll(".operator-filter")) {
        kept.add(checkbox.dataset.operator);
      }
    }
    const operators = countOperators(chargers, kept);
    const signature = JSON.stringify(operators);
    if (signature !== this.operatorsSignature) {
      this.operatorsSignature = signature;
      const template = this.filterPanel.querySelector(".operator-option-template");
      list.replaceChildren(
        ...operators.map(([operator, count]) => {
          const option = template.content.cloneNode(true);
          option.querySelector(".operator-filter").dataset.operator = operator;
          option.querySelector(".operator-name").textContent =
            operator || message("unknownOperator");
          option.querySelector(".operator-count").textContent = formatNumber(count);
          return option;
        })
      );
    }
    this.showOperatorChoices();
  }

  // Ticks the operators that are on, and offers "Show all" while any is off.
  showOperatorChoices() {
    if (!this.filterPanel) {
      return;
    }
    for (const checkbox of this.filterPanel.querySelectorAll(".operator-filter")) {
      checkbox.checked = !this.excludedOperators.has(checkbox.dataset.operator);
    }
    this.filterPanel.querySelector(".show-all-operators").hidden =
      this.excludedOperators.size === 0;
  }

  filtersChanged() {
    this.filtersUpdatedAt = Date.now();
    saveFilters(this.currentFilters());
    this.scheduleAccountSave();
    this.updateClearFiltersButtons();
    this.showMatchingChargers();
  }

  // The filters as saved, locally and to the account.
  currentFilters() {
    return {
      powerRanges: this.activePowerRanges(),
      connectorTypes: this.activeConnectorGroups(),
      excludedOperators: [...this.excludedOperators].sort(),
      onlyFavorites: this.favoritesFilterPressed(),
      nearby: this.pressedAmenities(),
      updatedAt: this.filtersUpdatedAt ?? 0,
    };
  }

  // "Clear filters" shows on the map and is enabled in the dialog only while
  // a filter is active, and the Filters button shows how many are (the
  // operator filter counts once, however many operators are off).
  updateClearFiltersButtons() {
    const count =
      this.activePowerRanges().length +
      this.activeConnectorGroups().length +
      (this.excludedOperators.size > 0 ? 1 : 0) +
      (this.onlyFavorites() ? 1 : 0) +
      this.activeAmenities().length;
    const active = count > 0;
    customElements
      .whenDefined("ev-filter-button")
      .then(() => this.querySelector("ev-filter-button")?.showActiveCount(count));
    for (const button of this.querySelectorAll(".clear-filters")) {
      if (this.filterPanel?.contains(button)) {
        button.disabled = !active;
      } else {
        button.hidden = !active;
      }
    }
  }

  activePowerRanges() {
    return [...this.querySelectorAll('.power-filter[aria-pressed="true"]')].map(
      (button) => button.dataset.powerRange
    );
  }

  activeConnectorGroups() {
    return [...this.querySelectorAll('.connector-filter[aria-pressed="true"]')].map(
      (button) => button.dataset.connectorGroup
    );
  }

  // Presses the buttons of the given filters; ones that no longer exist are
  // ignored.
  applyFilters({
    powerRanges = [],
    connectorTypes = [],
    excludedOperators = [],
    onlyFavorites = false,
    nearby = [],
    updatedAt = 0,
  }) {
    for (const button of this.querySelectorAll(".nearby-filter")) {
      button.setAttribute("aria-pressed", String(nearby.includes(button.dataset.amenity)));
    }
    this.querySelector(".favorites-filter")?.setAttribute("aria-pressed", String(onlyFavorites));
    this.excludedOperators = new Set(excludedOperators);
    this.showOperatorChoices();
    for (const button of this.querySelectorAll(".power-filter")) {
      button.setAttribute("aria-pressed", String(powerRanges.includes(button.dataset.powerRange)));
    }
    for (const button of this.querySelectorAll(".connector-filter")) {
      button.setAttribute(
        "aria-pressed",
        String(connectorTypes.includes(button.dataset.connectorGroup))
      );
    }
    this.filtersUpdatedAt = updatedAt;
    this.updateClearFiltersButtons();
  }

  // The filters saved on this device (IndexedDB).
  async restoreFilters() {
    this.applyFilters(await readFilters());
  }

  // Signed in, the newer of this device's and the account's filters wins:
  // the account's replace the device's (e.g. changed on another device), or
  // the device's are saved to the account (e.g. changed before signing in).
  async syncAccountFilters() {
    const settings = await fetchAccountSettings();
    await this.filtersRestored;
    if (!settings) {
      return;
    }
    const accountUpdatedAt = settings.filters?.updatedAt ?? 0;
    const deviceUpdatedAt = this.filtersUpdatedAt ?? 0;
    if (accountUpdatedAt > deviceUpdatedAt) {
      this.applyFilters(settings.filters);
      saveFilters(this.currentFilters());
      this.showMatchingChargers();
    } else if (deviceUpdatedAt > accountUpdatedAt) {
      this.saveFiltersToAccount();
    }
  }

  // Signed out, the dialog says that signing in keeps the filters on every
  // device, with a button that opens the sign-in options.
  showFilterSyncSignedIn(signedIn) {
    const prompt = this.filterPanel?.querySelector(".sync-sign-in");
    if (prompt) {
      prompt.hidden = signedIn;
    }
    if (!signedIn) {
      this.setSaveStatus("");
    }
  }

  setSaveStatus(text) {
    const status = this.filterPanel?.querySelector(".save-status");
    if (status) {
      status.textContent = text;
    }
  }

  // Signed in, saves the filters to the account a moment after the last
  // change, so toggling several makes one request.
  scheduleAccountSave() {
    clearTimeout(this.accountSaveTimer);
    if (isSignedIn()) {
      this.accountSaveTimer = setTimeout(() => this.saveFiltersToAccount(), ACCOUNT_SAVE_DELAY);
    }
  }

  // Saves now if a save is waiting, e.g. as the dialog closes.
  flushAccountSave() {
    if (this.accountSaveTimer) {
      clearTimeout(this.accountSaveTimer);
      this.saveFiltersToAccount();
    }
  }

  async saveFiltersToAccount() {
    this.accountSaveTimer = undefined;
    const saved = await saveAccountSettings({ filters: this.currentFilters() });
    // Only failures are worth a message; the device keeps the filters anyway.
    this.setSaveStatus(saved ? "" : message("filtersNotSaved"));
  }

  async loadEvChargers() {
    const bounds = this.map?.getBounds()?.toJSON();
    if (!bounds) {
      return;
    }
    setMapCenter(this.map.getCenter().toJSON());
    const searchId = ++this.searchId;
    const zoom = this.map.getZoom();

    // With a route, the chargers are the route's, at every zoom.
    if (this.route) {
      await this.showMatchingChargers();
      return;
    }

    if (zoom < this.minChargerZoom) {
      // Too large an area to load, but a country page has its own chargers.
      if (this.pageChargers?.length) {
        this.loaded = { chargers: this.pageChargers, truncated: this.pageChargersTruncated };
        await this.showMatchingChargers();
        return;
      }
      this.loaded = null;
      this.clearMarkers();
      this.listOperators([]);
      this.hideChargerDetails();
      this.setStatus(message("zoomIn"));
      return;
    }

    // A country page's chargers show while the area's tiles load.
    const pageChargersInView = this.pageChargers?.filter((charger) =>
      isInBounds(charger.location, bounds)
    );
    if (pageChargersInView?.length) {
      this.loaded = { chargers: pageChargersInView, truncated: this.pageChargersTruncated };
      await this.showMatchingChargers();
      if (searchId !== this.searchId) {
        return;
      }
    } else {
      this.setListedChargers([]);
      this.setStatus(message("loading"), "loading");
    }
    try {
      const { chargers, truncated } = await fetchChargersInBounds({ bounds, zoom });
      if (searchId !== this.searchId) {
        return;
      }
      this.loaded = { chargers, truncated };
      await this.showMatchingChargers();
    } catch (error) {
      console.error("Error loading EV chargers:", error);
      if (searchId !== this.searchId) {
        return;
      }
      if (navigator.onLine) {
        this.setStatus(message("loadFailed"), "error");
      } else {
        // Areas visited in the last day load from the service worker's cache.
        this.setStatus(message("offlineChargers"));
        window.addEventListener("online", () => this.loadEvChargers(), { once: true });
      }
    }
  }

  // Clusters and draws the loaded chargers that match the filters.
  async showMatchingChargers() {
    await this.filtersRestored;
    if (!this.loaded) {
      return;
    }
    const { chargers, truncated } = this.loaded;
    const ranges = this.filterPanel ? readActivePowerRanges(this.filterPanel) : [];
    const types = this.filterPanel ? readActiveConnectorTypes(this.filterPanel) : new Set();
    this.listOperators(chargers);
    const onlyFavorites = this.onlyFavorites();
    const amenities = this.activeAmenities();
    const matching = chargers.filter(
      (charger) =>
        matchesPower(charger, ranges) &&
        matchesConnectors(charger, types) &&
        !this.excludedOperators.has(operatorOf(charger)) &&
        (!onlyFavorites || isFavorite(charger.id)) &&
        amenities.every((amenity) => charger.amenities?.includes(amenity))
    );

    this.clusterIndex = new Supercluster({
      radius: CLUSTER_RADIUS,
      extent: CLUSTER_EXTENT,
      maxZoom: CLUSTER_MAX_ZOOM,
    }).load(matching.map(toFeature));
    await this.renderMarkers();
    this.setListedChargers(matching);

    if (
      this.activeChargerId != null &&
      !matching.some((charger) => charger.id === this.activeChargerId)
    ) {
      this.hideChargerDetails();
    }

    this.setStatus(
      chargerCountMessage({
        shown: matching.length,
        total: chargers.length,
        filtered: matching.length !== chargers.length,
        truncated,
        alongRoute: Boolean(this.route),
      }),
      matching.length ? "success" : "idle"
    );
  }

  // The status pill opens the list of these chargers, so it's disabled when
  // there are none.
  setListedChargers(chargers) {
    this.listedChargers = chargers;
    if (this.statusButton) {
      this.statusButton.disabled = chargers.length === 0;
    }
  }

  // Lists the chargers in order along the route, or nearest first: to the
  // user if they've been located, otherwise to the center of the map.
  renderChargerList() {
    const origin = this.userLocation ?? this.map.getCenter().toJSON();
    this.sortedChargers = this.listedChargers
      .map((charger) => ({
        charger,
        meters: this.route
          ? charger.route.distanceFromStartMeters
          : distanceInMeters(origin, charger.location),
      }))
      .sort((a, b) => a.meters - b.meters);

    const list = this.chargerList;
    const count = this.sortedChargers.length;
    list.querySelector(".title").textContent = message("chargerCount", { count });
    list.querySelector(".sort-basis").textContent = message(
      this.route ? "alongRoute" : this.userLocation ? "nearestToYou" : "nearestToCenter"
    );

    const template = list.querySelector(".item-template");
    list.querySelector(".items").replaceChildren(
      ...this.sortedChargers.map(({ charger, meters }, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".entry").dataset.index = String(index);
        item.querySelector(".name").textContent = chargerName(charger);
        item.querySelector(".distance").textContent = formatDistance(meters);
        item.querySelector(".meta").textContent = [
          charger.maxPowerKw ? message("power", { power: charger.maxPowerKw }) : null,
          this.route
            ? message("offRoute", {
                distance: formatDistance(charger.route.distanceFromRouteMeters),
              })
            : null,
          charger.address,
        ]
          .filter(Boolean)
          .join(" · ");
        return item;
      })
    );
    list.querySelector(".body").scrollTop = 0;
  }

  // Plans the route with Google's Routes library, draws it, and shows the
  // chargers along it (POST /api/chargers/route) instead of the map's.
  async showRoute({ origin, destination }) {
    await this.mapReady;
    const searchId = ++this.searchId;
    this.setStatus(message("routeLoading"), "loading");
    try {
      const { Route } = await this.maps.importLibrary("routes");
      const { routes } = await Route.computeRoutes({
        origin: routeEndpoint(origin),
        destination: routeEndpoint(destination),
        travelMode: "DRIVING",
        fields: ["path"],
        language: document.documentElement.lang,
      });
      const path = routes?.[0]?.path?.map(toLatLng);
      if (!path?.length) {
        if (searchId === this.searchId) {
          this.setStatus(message("noRoute"), "error");
        }
        return;
      }
      const { chargers, full } = await fetchChargersAlongRoute(path);
      if (searchId !== this.searchId) {
        return;
      }
      const { Polyline } = await this.maps.importLibrary("maps");
      this.removeRouteLine();
      this.route = {
        line: new Polyline({ ...ROUTE_LINE, path, map: this.map, strokeColor: this.routeColor }),
      };
      this.loaded = { chargers, truncated: full };
      this.setRouteShown(true);
      this.hideChargerDetails();
      this.map.fitBounds(pathBounds(path), ROUTE_PADDING);
      await this.showMatchingChargers();
    } catch (error) {
      console.error("Could not plan the route:", error);
      if (searchId === this.searchId) {
        this.setStatus(message(navigator.onLine ? "routeFailed" : "offlineChargers"), "error");
      }
    }
  }

  clearRoute() {
    if (!this.route) {
      return;
    }
    this.removeRouteLine();
    this.route = null;
    this.loaded = null;
    this.setRouteShown(false);
    this.clearMarkers();
    this.hideChargerDetails();
    this.loadEvChargers();
  }

  removeRouteLine() {
    this.route?.line.setMap(null);
  }

  setRouteShown(shown) {
    if (this.clearRouteButton) {
      this.clearRouteButton.hidden = !shown;
    }
    this.routePlanner?.setRouteShown(shown);
  }

  // The line's color is a design token (--color-route in global.css).
  get routeColor() {
    return getComputedStyle(this).getPropertyValue("--route-color").trim();
  }

  // The status pill morphs into the list: only one element at a time may
  // carry the shared view-transition-name, so it moves inside the update.
  openChargerList() {
    if (!this.chargerList || this.chargerList.open || !this.listedChargers?.length) {
      return;
    }
    track("list_opened");
    this.renderChargerList();
    this.statusButton.classList.add("list-transition");
    withViewTransition(() => {
      this.statusButton.classList.remove("list-transition");
      this.chargerList.classList.add("list-transition");
      this.chargerList.showModal();
    }).finally(() => this.chargerList.classList.remove("list-transition"));
  }

  closeChargerList() {
    if (!this.chargerList?.open) {
      return Promise.resolve();
    }
    this.chargerList.classList.add("list-transition");
    return withViewTransition(() => {
      this.chargerList.classList.remove("list-transition");
      this.chargerList.close();
      this.statusButton.classList.add("list-transition");
    }).finally(() => this.statusButton.classList.remove("list-transition"));
  }

  // Whether "Only favorites" is pressed; it only applies signed in.
  favoritesFilterPressed() {
    return this.querySelector(".favorites-filter")?.getAttribute("aria-pressed") === "true";
  }

  onlyFavorites() {
    return isSignedIn() && this.favoritesFilterPressed();
  }

  pressedAmenities() {
    return [...this.querySelectorAll('.nearby-filter[aria-pressed="true"]')].map(
      (button) => button.dataset.amenity
    );
  }

  // The kinds of places a charger must have next to it; only signed in.
  activeAmenities() {
    return isSignedIn() ? this.pressedAmenities() : [];
  }

  // Signed out, the heart, "Only favorites" and the nearby places look
  // disabled, say to sign in, and open the sign-in options.
  showFavoritesSignedIn(signedIn) {
    for (const button of this.querySelectorAll(
      ".favorite-button, .favorites-filter, .nearby-filter"
    )) {
      button.setAttribute("aria-disabled", String(!signedIn));
    }
    for (const hint of this.querySelectorAll(
      "#favorite-sign-in-hint, #favorites-filter-hint, #nearby-filter-hint"
    )) {
      hint.hidden = signedIn;
    }
    this.showFavoriteState();
    this.updateClearFiltersButtons();
    this.showMatchingChargers();
  }

  // The heart is filled while the open charger is a favorite.
  showFavoriteState() {
    const button = this.detailsPanel?.querySelector(".favorite-button");
    if (!button) {
      return;
    }
    const favorite =
      Boolean(this.activeCharger) && isSignedIn() && isFavorite(this.activeCharger.id);
    button.setAttribute("aria-pressed", String(favorite));
  }

  async toggleFavorite() {
    const charger = this.activeCharger;
    if (!charger) {
      return;
    }
    if (!isSignedIn()) {
      requestSignIn();
      return;
    }
    if (isFavorite(charger.id)) {
      await removeFavorite(charger.id);
    } else {
      await addFavorite(charger);
    }
  }

  // Shows a favorite on the map, with its details, wherever it is.
  async showFavoriteCharger(charger) {
    await this.mapReady;
    this.displayChargerDetails(charger);
    this.map.setZoom(this.unclusteredZoom(charger));
    this.centerInVisibleArea(charger.location);
  }

  async showChargerFromList(charger) {
    await this.closeChargerList();
    this.displayChargerDetails(charger);
    this.map.setZoom(this.unclusteredZoom(charger));
    this.centerInVisibleArea(charger.location);
  }

  // The lowest zoom (at least LIST_ZOOM) at which the charger has its own pin
  // instead of being part of a cluster.
  unclusteredZoom(charger) {
    const { lat, lng } = charger.location;
    const around = [lng - 1e-6, lat - 1e-6, lng + 1e-6, lat + 1e-6];
    const fromZoom = Math.max(Math.floor(this.map.getZoom()), LIST_ZOOM);
    for (let zoom = fromZoom; zoom <= CLUSTER_MAX_ZOOM; zoom++) {
      const features = this.clusterIndex?.getClusters(around, zoom) ?? [];
      if (features.some((f) => !f.properties.cluster && f.properties.charger.id === charger.id)) {
        return zoom;
      }
    }
    return CLUSTER_MAX_ZOOM + 1;
  }

  // Centers a location in the part of the map the details panel leaves
  // visible: above the bottom sheet on small screens, right of the side
  // panel otherwise. Uses layout offsets, as the panel may still be sliding
  // in with a transform.
  centerInVisibleArea(location) {
    this.map.setCenter(location);
    const panel = this.detailsPanel;
    const container = panel?.offsetParent;
    if (!panel || panel.hidden || !container) {
      return;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    const isBottomSheet = panel.offsetWidth >= width - 1;
    const target = isBottomSheet
      ? { x: width / 2, y: panel.offsetTop / 2 }
      : { x: (panel.offsetLeft + panel.offsetWidth + width) / 2, y: height / 2 };
    // Panning the view by (dx, dy) moves the content by (-dx, -dy).
    this.map.panBy(width / 2 - target.x, height / 2 - target.y);
  }

  clearMarkers() {
    for (const marker of this.markersById.values()) {
      marker.map = null;
    }
    this.markersById.clear();
    this.chargersByMarker.clear();
    this.clusterIndex = null;
    this.setListedChargers([]);
    this.activeMarker = null;
  }

  cloneTemplate(selector) {
    return this.querySelector(selector)?.content.firstElementChild.cloneNode(true);
  }

  setActiveMarker(marker) {
    this.activeMarker?.content?.classList.remove("active");
    this.activeMarker = marker;
    marker?.content?.classList.add("active");
  }

  createChargerMarker(AdvancedMarkerElement, charger) {
    const marker = new AdvancedMarkerElement({
      map: this.map,
      position: charger.location,
      title: chargerName(charger),
      content: this.cloneTemplate(".charger-marker-template"),
      gmpClickable: true,
    });
    marker.addEventListener("gmp-click", () => {
      this.setActiveMarker(marker);
      this.displayChargerDetails(charger);
    });
    this.chargersByMarker.set(marker, charger);
    this.showMarkerAvailability(marker);
    return marker;
  }

  // Red while the charger's live statuses (already loaded) say none of its
  // points is free; pink with a heart for a favorite; and either in the
  // pin's name.
  showMarkerAvailability(marker) {
    const charger = this.chargersByMarker.get(marker);
    const ids = liveStatusIds(charger);
    const full = isSignedIn() && ids.length > 0 && noneFree(this.cachedStatuses(ids)) === true;
    const favorite = isFavorite(charger.id);
    marker.content?.classList.toggle("none-free", full);
    marker.content?.classList.toggle("favorite", favorite);
    const name = chargerName(charger);
    const key = favorite
      ? full
        ? "chargerFavoriteNoneFree"
        : "chargerFavorite"
      : full
        ? "chargerNoneFree"
        : null;
    marker.title = key ? message(key, { name }) : name;
  }

  // Signed in, loads the live statuses of the chargers pinned on the map
  // (in batches, the recent ones from memory) and colors their pins.
  async showPinAvailability() {
    const markers = [...this.markersById.values()].filter((marker) =>
      this.chargersByMarker.has(marker)
    );
    if (isSignedIn()) {
      const ids = markers.flatMap((marker) => liveStatusIds(this.chargersByMarker.get(marker)));
      try {
        await this.loadStatuses(ids);
      } catch (error) {
        console.error("Could not load the chargers' availability:", error);
      }
    }
    for (const marker of markers) {
      this.showMarkerAvailability(marker);
    }
  }

  createClusterMarker(AdvancedMarkerElement, cluster) {
    const { cluster_id: clusterId, point_count: count } = cluster.properties;
    const [lng, lat] = cluster.geometry.coordinates;
    const content = this.cloneTemplate(".charger-cluster-template");
    content.querySelector(".count").textContent = String(count);
    const size = CLUSTER_SIZES.find(({ minCount }) => count >= minCount)?.size;
    if (size) {
      content.classList.add(size);
    }
    const marker = new AdvancedMarkerElement({
      map: this.map,
      position: { lat, lng },
      title: message("chargerCount", { count }),
      content,
      gmpClickable: true,
    });
    marker.addEventListener("gmp-click", () => {
      this.map.setCenter({ lat, lng });
      this.map.setZoom(this.clusterIndex.getClusterExpansionZoom(clusterId));
    });
    return marker;
  }

  // Draws the clusters and chargers in view. Markers that are still in view
  // are kept, so they don't flicker on every move.
  async renderMarkers() {
    // getBounds() is undefined until the map has rendered, e.g. when Google
    // Maps failed to load.
    const bounds = this.map.getBounds()?.toJSON();
    if (!bounds) {
      return;
    }
    const { AdvancedMarkerElement } = await this.maps.importLibrary("marker");
    const { north, south, east, west } = bounds;
    const zoom = Math.floor(this.map.getZoom());
    const features = this.clusterIndex.getClusters([west, south, east, north], zoom);

    const featuresByKey = new Map(
      features.map((feature) => [
        feature.properties.cluster
          ? `cluster:${zoom}:${feature.properties.cluster_id}`
          : `charger:${feature.properties.charger.id}`,
        feature,
      ])
    );

    for (const [key, marker] of this.markersById) {
      if (!featuresByKey.has(key)) {
        marker.map = null;
        this.markersById.delete(key);
        this.chargersByMarker.delete(marker);
      }
    }

    for (const [key, feature] of featuresByKey) {
      if (!this.markersById.has(key)) {
        this.markersById.set(
          key,
          feature.properties.cluster
            ? this.createClusterMarker(AdvancedMarkerElement, feature)
            : this.createChargerMarker(AdvancedMarkerElement, feature.properties.charger)
        );
      }
    }

    // The charger whose details are open keeps its highlighted pin.
    const activeMarker = this.markersById.get(`charger:${this.activeChargerId}`);
    if (activeMarker && activeMarker !== this.activeMarker) {
      this.setActiveMarker(activeMarker);
    }
    this.showPinAvailability();
  }

  fillList(list, items) {
    const template = this.detailsPanel.querySelector(".item-template");
    list.replaceChildren(
      ...items.map((text) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.textContent = text;
        return item;
      })
    );
  }

  displayChargerDetails(charger) {
    const panel = this.detailsPanel;
    if (!panel) {
      return;
    }
    if (this.activeChargerId !== charger.id) {
      track("charger_opened", charger.source);
    }
    this.activeChargerId = charger.id;
    this.activeCharger = charger;
    panel.querySelector(".name").textContent = chargerName(charger);
    panel.querySelector(".address .text").textContent = charger.address;
    this.fillList(panel.querySelector(".connectors"), charger.connectors.map(formatConnector));
    this.fillList(panel.querySelector(".details"), formatDetails(charger));
    const nearby = charger.amenities ?? [];
    this.fillList(
      panel.querySelector(".nearby-places"),
      nearby.map((amenity) => valueLabel("amenities", amenity))
    );
    panel.querySelector(".nearby").hidden = nearby.length === 0;
    // A charger merged from several sources credits each of them, and
    // OpenStreetMap for the places next to it.
    const sources = [
      ...(charger.sources ?? [charger.source]),
      ...(nearby.length ? ["osm-places"] : []),
    ];
    for (const attribution of panel.querySelectorAll(".attribution")) {
      attribution.hidden = !sources.includes(attribution.dataset.source);
    }
    panel.hidden = false;
    this.showFavoriteState();
    this.showAvailability(charger);
  }

  // Loads the live statuses of the IDs that aren't in memory or are older
  // than a minute, from the Worker (GET /api/chargers/status) in batches.
  // False if the Worker wants a signed-in user.
  async loadStatuses(ids) {
    const fresh = (id) => Date.now() - (this.statuses.get(id)?.fetchedAt ?? 0) < STATUS_MAX_AGE_MS;
    const missing = [...new Set(ids)].filter((id) => !fresh(id));
    for (let start = 0; start < missing.length; start += STATUS_BATCH_SIZE) {
      const batch = missing.slice(start, start + STATUS_BATCH_SIZE);
      const response = await fetch(`/api/chargers/status?ids=${batch.join(",")}`);
      if (response.status === 401) {
        return false;
      }
      const { statuses } = response.ok ? await response.json() : { statuses: {} };
      for (const id of batch) {
        this.statuses.set(id, { status: statuses[id] ?? null, fetchedAt: Date.now() });
      }
    }
    return true;
  }

  // The statuses in memory for the IDs that have one.
  cachedStatuses(ids) {
    return ids.map((id) => this.statuses.get(id)?.status).filter(Boolean);
  }

  // The charger's live statuses, by ID: from memory if recent, else the
  // Worker; null if the Worker wants a signed-in user.
  async fetchStatuses(ids) {
    return (await this.loadStatuses(ids)) ? this.cachedStatuses(ids) : null;
  }

  // Signed out, the section asks to sign in instead of showing statuses.
  showAvailabilitySignIn(section, signInNeeded) {
    for (const element of section.querySelectorAll(".free, .out-of-service, .updated")) {
      element.hidden = signInNeeded;
    }
    section.querySelector(".sign-in-needed").hidden = !signInNeeded;
    section.querySelector(".sign-in-button").hidden = !signInNeeded;
  }

  // How many of the charger's points are free right now, where a source
  // publishes it; the section stays hidden otherwise. It needs a signed-in
  // user (the Worker says 401 otherwise).
  async showAvailability(charger) {
    const section = this.detailsPanel.querySelector(".availability");
    section.hidden = true;
    const ids = liveStatusIds(charger);
    if (!ids.length) {
      return;
    }
    if (!isSignedIn()) {
      this.showAvailabilitySignIn(section, true);
      section.hidden = false;
      return;
    }
    let statuses;
    try {
      statuses = await this.fetchStatuses(ids);
    } catch (error) {
      console.error("Could not load the charger's availability:", error);
      return;
    }
    if (this.activeChargerId !== charger.id) {
      return;
    }
    if (!statuses) {
      this.showAvailabilitySignIn(section, true);
      section.hidden = false;
      return;
    }
    if (!statuses.length) {
      return;
    }
    this.showAvailabilitySignIn(section, false);
    const sum = (field) => statuses.reduce((total, status) => total + status[field], 0);
    const outOfService = sum("outOfService");
    section.querySelector(".free").textContent = message("pointsFree", {
      available: sum("available"),
      count: sum("total"),
    });
    const outOfServiceEl = section.querySelector(".out-of-service");
    outOfServiceEl.textContent = message("pointsOutOfService", { count: outOfService });
    outOfServiceEl.hidden = outOfService === 0;
    section.querySelector(".updated").textContent = message("statusUpdated", {
      time: minutesAgo(Math.min(...statuses.map((status) => status.updatedAt))),
    });
    section.hidden = false;
  }

  hideChargerDetails() {
    if (this.detailsPanel) {
      this.detailsPanel.hidden = true;
    }
    this.activeChargerId = null;
    this.activeCharger = null;
    this.setActiveMarker(null);
  }
}

customElements.define("ev-google-map", GoogleMapElement);

export { GoogleMapElement };
