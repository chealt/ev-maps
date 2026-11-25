import { fetchChargersInBounds } from "./chargers.js";
import { chargerName } from "../../lib/charger-name.js";
import { pricinessAmong } from "../../lib/priciness.js";
import { distanceInMeters, formatDistance } from "../../lib/distance.js";
import { addFavorite, isFavorite, onFavoritesChange, removeFavorite } from "../../lib/favorites.js";
import { setMapCenter } from "../../lib/map-center.js";
import { track } from "../../lib/usage.js";
import { formatNumber, freeLabel, message, valueLabel } from "../../lib/messages.js";
import { isSignedIn, onSessionChange, requestSignIn } from "../../lib/session.js";
import { chosenCar, onCarChange } from "../../lib/car.js";
import { fetchAccountSettings, saveAccountSettings } from "../../lib/account-settings.js";
import { loadGoogleMaps } from "./loader.js";
import { mapsApp, mapsAppUrl, onMapsAppChange, setMapsApp } from "../../lib/maps-app.js";
import { animateEscape, closeDialog, openDialog, withViewTransition } from "../../lib/motion.js";
import { ChargerIndexClient } from "./charger-index-client.js";
import { operatorOf } from "./charger-index.js";
import { forgetRouteHistory, recordRoute } from "./route-history.js";
import { CORRIDOR_KM, fetchChargersAlongRoute, pathBounds, toLatLng } from "./route.js";
import { routeFromUrl } from "./route-url.js";
import { planState, samePlan } from "./route-cache.js";
import {
  readFilters,
  readMapView,
  readRoute,
  saveFilters,
  saveMapView,
  saveRoute,
} from "./saved-state.js";

// Signed in, filters are saved to the account this long after the last change.
const ACCOUNT_SAVE_DELAY = 1000;

// How a cluster's pin is sized by its count (clustering: ./charger-index.js).
const CLUSTER_SIZES = [
  { minCount: 100, size: "large" },
  { minCount: 10, size: "medium" },
];
// Google Maps color schemes for the themes set by ThemePicker on <html>.
const COLOR_SCHEMES = { system: "FOLLOW_SYSTEM", light: "LIGHT", dark: "DARK" };

const currentColorScheme = () =>
  COLOR_SCHEMES[document.documentElement.dataset.theme] ?? COLOR_SCHEMES.system;

// Maps a connector type ID to its standard plug diagram in GoogleMap.astro.
const connectorDiagram = (type) => {
  if (type === "ccs1" || type === "ccs2") {
    return "ccs";
  }
  if (type === "chademo" || type === "gbt-dc") {
    return "chademo";
  }
  if (type?.startsWith("tesla") || type === "nacs") {
    return "tesla";
  }
  if (type?.startsWith("type2")) {
    return "type2";
  }
  if (type === "type1") {
    return "type1";
  }
  return "household";
};

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

// How a priciness (../../lib/priciness.js) reads, e.g. { scale: "$$",
// comparison: "pricier than 40% of the chargers here" }; null without one.
const describePriciness = (price) => {
  if (!price) {
    return null;
  }
  // Whichever side is larger: "pricier than 70%", "cheaper than 80%".
  return {
    scale: "$".repeat(price.level),
    comparison:
      price.cheaper === 0
        ? message("cheapestHere")
        : price.cheaper > price.pricier
          ? message("pricierThan", { percent: Math.round(price.cheaper * 100) })
          : message("cheaperThan", { percent: Math.round(price.pricier * 100) }),
  };
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
// Dropping a pin starts this close to the address: a street, its buildings.
const PICK_ZOOM = 18;
// The route: a line over a wider casing in the opposite lightness, both
// opaque, so it stands out on any part of either theme's map.
const ROUTE_LINE = { strokeOpacity: 1, strokeWeight: 5, zIndex: 2 };
const ROUTE_CASING = { strokeOpacity: 1, strokeWeight: 9, zIndex: 1 };

// A chosen place, as the Routes library takes it: a Google Place, or a location.
const routeEndpoint = ({ place, location }) => place ?? location;

// A chosen place as it's saved: a Google place by its ID, or a location
// (keeping any charger ID so a stop matches the charger on the map).
const savedEnd = ({ id, label, place, location }) =>
  place?.id ? { label, placeId: place.id } : { ...(id ? { id } : {}), label, location };

const LIST_ZOOM = 15;

const boundsCenter = ({ north, south, east, west }) => ({
  lat: (north + south) / 2,
  lng: (east + west) / 2,
});

// A pin's size on the map, in pixels, roughly (--marker-size and its tip).
const PIN_SIZE = 40;
const TILE_SIZE = 256;

// A location's pixel in the whole world's map at a zoom (Web Mercator).
const worldPixel = ({ lat, lng }, zoom) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const isInBounds = ({ lat, lng }, { north, south, east, west }) =>
  lat >= south && lat <= north && lng >= west && lng <= east;

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

// How many of the chargers each operator has: most first, then by name, the
// unknown operator last. The `kept` operators are listed even without
// chargers, e.g. ones turned off, so they can be turned back on.
const countOperators = (chargers, kept, available = chargers) => {
  // Every loaded charger's operator is listed, with how many of the
  // `available` ones (those the other filters leave) it has, maybe none.
  const counts = new Map([...kept, ...chargers.map(operatorOf)].map((operator) => [operator, 0]));
  for (const charger of available) {
    const operator = operatorOf(charger);
    counts.set(operator, counts.get(operator) + 1);
  }
  return [...counts].sort(
    ([nameA, countA], [nameB, countB]) =>
      countB - countA || (nameA === "") - (nameB === "") || nameA.localeCompare(nameB)
  );
};

class GoogleMapElement extends HTMLElement {
  map = null;
  maps = null;
  markersById = new Map();
  statuses = new Map();
  // The charger each charger pin (not cluster) is for.
  chargersByMarker = new Map();
  searchId = 0;
  routeId = 0;
  // The loaded chargers' filtering and clustering, off the main thread.
  chargerIndex = new ChargerIndexClient();
  // The loaded chargers by ID, to map the index's answers back to them.
  chargersById = new Map();
  mapReady = new Promise((resolve) => {
    this.resolveMapReady = resolve;
  });

  handleThemeChange = () => this.recreateMap();
  // Following the system theme, the map changes by itself; the route's
  // colors are this page's, so they follow too.
  systemScheme = window.matchMedia("(prefers-color-scheme: dark)");
  handleSystemSchemeChange = () => this.recolorRoute();

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
    // In the top bar, next to Locate Me, outside this element.
    this.zoomRouteButton = document.querySelector(".map-actions .zoom-route");

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
    this.systemScheme.removeEventListener("change", this.handleSystemSchemeChange);
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
    // The suggest-a-charger dialog asks for a pin dropped on the map.
    document.addEventListener("pick-map-location", ({ detail }) => this.pickLocation(detail));
    this.querySelector(".pick-confirm")?.addEventListener("click", () =>
      this.finishPicking(this.map.getCenter().toJSON())
    );
    this.querySelector(".pick-cancel")?.addEventListener("click", () => this.finishPicking(null));
    // The locate button is in the top bar (the account menu's), outside this
    // element, so its events are heard on the document.
    document.addEventListener("locate-start", () => {
      track("locate_me");
      this.setStatus(message("locating"), "loading");
    });
    document.addEventListener("location-found", (event) => this.handleLocationFound(event));
    document.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || message("locationFailed"), "error")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());
    this.addEventListener("open-route-planner", () => this.routePlanner?.open());
    this.addEventListener("place-chosen", (event) => this.showPlace(event.detail));
    this.addEventListener("place-navigate", (event) => this.routePlanner?.planTo(event.detail));
    this.addEventListener("route-requested", (event) =>
      this.showRoute({ ...event.detail, record: true })
    );
    this.addEventListener("route-from-history", (event) => this.showRouteFromHistory(event.detail));
    this.addEventListener("route-cleared", () => this.clearRoute());
    this.clearRouteButton?.addEventListener("click", () => this.clearRoute());
    this.zoomRouteButton?.addEventListener("click", () => this.zoomToRoute());
    // The status pill opens the list of chargers, or, too far out to load
    // any, zooms in to where they load.
    this.statusButton?.addEventListener("click", () => {
      if (this.statusButton.dataset.state === "warning") {
        this.map?.setZoom(this.minChargerZoom);
        return;
      }
      this.openChargerList();
    });
    this.chargerList
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.closeChargerList());
    // Escape closes the dialog without a transition, so close it with one.
    this.chargerList?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.closeChargerList();
    });
    this.chargerList?.querySelector(".sort-options")?.addEventListener("change", () => {
      this.renderChargerList();
    });
    this.chargerList?.querySelector(".items")?.addEventListener("click", (event) => {
      const entry = event.target.closest(".entry");
      if (entry) {
        this.showChargerFromList(this.sortedChargers[Number(entry.dataset.index)].charger);
      }
    });
    document.addEventListener("theme-change", this.handleThemeChange);
    this.systemScheme.addEventListener("change", this.handleSystemSchemeChange);
    this.showFilterSyncSignedIn(isSignedIn());
    // The session may have loaded before the map did.
    const accountFiltersSynced = isSignedIn() ? this.syncAccountFilters() : Promise.resolve();
    // The car's automatic filter wins over the saved filters' connectors,
    // once both the device's and the account's are in.
    Promise.all([this.filtersRestored, accountFiltersSynced]).then(() => this.applyCarFilter());
    onCarChange(() => this.carChanged());
    this.updateCarFilterButton();
    // Signed in, pins turn red while none of their charger's points is free.
    this.pinStatusTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        this.showPinAvailability();
      }
    }, PIN_STATUS_REFRESH_MS);
    this.showFavoritesSignedIn(isSignedIn());
    if (isSignedIn()) {
      this.restoreRoute();
    }
    onSessionChange((signedIn) => {
      if (!signedIn) {
        this.statuses.clear();
      }
      this.showPinAvailability();
      this.showFavoritesSignedIn(signedIn);
      this.showFilterSyncSignedIn(signedIn);
      if (signedIn) {
        this.syncAccountFilters();
        this.restoreRoute();
      } else {
        // Routes are for signed-in users; the next one starts afresh.
        saveRoute(null);
        forgetRouteHistory();
      }
    });
    // Live availability needs a signed-in user; show it once there is one.
    onSessionChange(() => {
      if (this.activeCharger && !this.detailsPanel?.hidden) {
        this.showAvailability(this.activeCharger);
      }
    });
    this.detailsPanel
      ?.querySelector(".connectors-section .sign-in-button")
      ?.addEventListener("click", () => requestSignIn());

    this.detailsPanel
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.closeChargerDetails());
    // Escape closes the charger's details, unless a dialog (the filters, the
    // charger list) is open: those close themselves with it. The letters are
    // the map's shortcuts (see the ? dialog): f filters, c clears them, l
    // locates, r plans a route, x clears it. Not while typing or in a dialog: those keys
    // belong to it.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!this.detailsPanel?.hidden && !this.querySelector("dialog[open]")) {
          this.closeChargerDetails();
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
        return;
      }
      const target = event.target;
      if (
        target.matches?.("input, textarea, select, [contenteditable]") ||
        this.querySelector("dialog[open]")
      ) {
        return;
      }
      const shortcuts = {
        f: () => this.toggleFilters(),
        c: () => !this.querySelector(".map-controls .clear-filters")?.hidden && this.clearFilters(),
        l: () => document.querySelector("ev-locate-button button")?.click(),
        r: () => this.routePlanner?.open(),
        s: () => this.querySelector("ev-place-search")?.open(),
        x: () => this.route && this.clearRoute(),
      };
      shortcuts[event.key.toLowerCase()]?.();
    });
    this.detailsPanel
      ?.querySelector(".favorite-button")
      ?.addEventListener("click", () => this.toggleFavorite());
    // Navigate: a route to the open charger, planned here.
    this.detailsPanel?.querySelector(".navigate")?.addEventListener("click", () => {
      const charger = this.activeCharger;
      if (charger) {
        this.routePlanner?.planTo({ label: chargerName(charger), location: charger.location });
      }
    });
    // Add to route: adds or removes the open charger as a stop along a route.
    this.detailsPanel?.querySelector(".add-to-route")?.addEventListener("click", () => {
      const charger = this.activeCharger;
      if (charger) {
        this.routePlanner?.toggleStop({
          id: charger.id,
          label: chargerName(charger),
          location: charger.location,
        });
        this.showRouteStopState(charger);
      }
    });
    this.setupOpenInMaps();
    // A charger picked in the favorites list.
    document.addEventListener("show-charger", (event) =>
      this.showFavoriteCharger(event.detail.charger)
    );
    onFavoritesChange(() => {
      this.showFavoriteState();
      for (const marker of this.markersById.values()) {
        if (this.chargersByMarker.has(marker)) {
          this.showMarkerAvailability(marker);
        } else if (marker.clusterId != null) {
          this.showClusterFavorite(marker);
        }
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
      button.addEventListener("click", () => closeDialog(this.filterPanel));
    }
    if (this.filterPanel) {
      animateEscape(this.filterPanel);
    }
    // However the dialog closes (buttons, Escape), the Filters button follows.
    this.filterPanel?.addEventListener("close", () => {
      this.querySelector(".filter-button")?.setAttribute("aria-expanded", "false");
      // Operators kept in place while the dialog was open can go now.
      this.listOperators(this.loaded?.chargers ?? [], this.availableChargers);
      this.flushAccountSave();
    });
    // Leaving the page doesn't lose a save that's waiting.
    window.addEventListener("pagehide", () => this.flushAccountSave());
  }

  // States: idle, loading, success, error, and warning, where the pill zooms
  // in instead of opening the list.
  setStatus(message, state = "idle") {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusButton.dataset.state = state;
      if (state === "warning") {
        this.statusButton.removeAttribute("aria-haspopup");
        this.statusButton.disabled = false;
      } else {
        this.statusButton.setAttribute("aria-haspopup", "dialog");
        this.statusButton.disabled = !this.listedChargers?.length;
      }
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
      document.querySelector("ev-locate-button[data-auto-locate]")?.locateIfPermitted();
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
    this.route?.casing.setMap(this.map);
    this.route?.line.setMap(this.map);
    this.recolorRoute();
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
    this.querySelector(".filter-button")?.setAttribute("aria-expanded", "true");
    openDialog(this.filterPanel);
  }

  handleFilterClick(event) {
    if (event.target.closest(".sync-sign-in-button")) {
      this.filterPanel.close();
      requestSignIn();
      return;
    }
    if (event.target.closest(".car-filter")) {
      this.selectCarConnectors();
      return;
    }
    if (event.target.closest(".show-all-operators")) {
      this.excludedOperators.clear();
      this.showOperatorChoices();
      this.filtersChanged();
      return;
    }
    const signedInFilter = event.target.closest(
      ".favorites-filter, .availability-filter, .nearby-filter"
    );
    if (signedInFilter?.getAttribute("aria-disabled") === "true") {
      this.filterPanel.close();
      requestSignIn();
      return;
    }
    const button = event.target.closest(
      ".power-filter, .connector-filter, .price-filter, .favorites-filter, .availability-filter, .nearby-filter"
    );
    if (!button) {
      return;
    }
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    if (button.getAttribute("aria-pressed") === "true") {
      // Which kind of filter: "power", "connector", "price", "favorites", "nearby".
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
      ".power-filter, .connector-filter, .price-filter, .favorites-filter, .availability-filter, .nearby-filter"
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
  // `available` are the chargers the other filters leave: operators with
  // none of them are listed, but can't be picked (unless they're turned
  // off, so they can be turned back on).
  listOperators(chargers, available = chargers) {
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
    const operators = countOperators(chargers, kept, available);
    const signature = JSON.stringify(operators);
    if (signature !== this.operatorsSignature) {
      this.operatorsSignature = signature;
      const template = this.filterPanel.querySelector(".operator-option-template");
      list.replaceChildren(
        ...operators.map(([operator, count]) => {
          const option = template.content.cloneNode(true);
          const checkbox = option.querySelector(".operator-filter");
          checkbox.dataset.operator = operator;
          checkbox.dataset.count = String(count);
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
      const excluded = this.excludedOperators.has(checkbox.dataset.operator);
      checkbox.checked = !excluded;
      checkbox.disabled = !excluded && checkbox.dataset.count === "0";
    }
    this.filterPanel.querySelector(".show-all-operators").hidden =
      this.excludedOperators.size === 0;
  }

  filtersChanged() {
    this.filtersUpdatedAt = Date.now();
    saveFilters(this.currentFilters());
    this.scheduleAccountSave();
    this.updateClearFiltersButtons();
    this.updateCarFilterButton();
    this.showMatchingChargers();
  }

  // The filters as saved, locally and to the account.
  currentFilters() {
    return {
      powerRanges: this.activePowerRanges(),
      connectorTypes: this.activeConnectorGroups(),
      priceLevels: this.activePriceLevels(),
      excludedOperators: [...this.excludedOperators].sort(),
      onlyFavorites: this.favoritesFilterPressed(),
      hideUnavailable: this.availabilityFilterPressed(),
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
      this.activePriceLevels().length +
      (this.excludedOperators.size > 0 ? 1 : 0) +
      (this.onlyFavorites() ? 1 : 0) +
      (this.hideUnavailable() ? 1 : 0) +
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

  // The price levels on ("1" cheaper, "2" average, "3" pricier).
  activePriceLevels() {
    return [...this.querySelectorAll('.price-filter[aria-pressed="true"]')].map(
      (button) => button.dataset.priceLevel
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
    priceLevels = [],
    excludedOperators = [],
    onlyFavorites = false,
    hideUnavailable = false,
    nearby = [],
    updatedAt = 0,
  }) {
    for (const button of this.querySelectorAll(".nearby-filter")) {
      button.setAttribute("aria-pressed", String(nearby.includes(button.dataset.amenity)));
    }
    this.querySelector(".favorites-filter")?.setAttribute("aria-pressed", String(onlyFavorites));
    this.querySelector(".availability-filter")?.setAttribute(
      "aria-pressed",
      String(hideUnavailable)
    );
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
    for (const button of this.querySelectorAll(".price-filter")) {
      button.setAttribute("aria-pressed", String(priceLevels.includes(button.dataset.priceLevel)));
    }
    this.filtersUpdatedAt = updatedAt;
    this.updateClearFiltersButtons();
  }

  // The filters saved on this device (IndexedDB).
  async restoreFilters() {
    this.applyFilters(await readFilters());
  }

  // "My car" in the filter dialog: selects exactly the car's connector
  // groups.
  selectCarConnectors() {
    const { connectors } = chosenCar();
    for (const button of this.querySelectorAll(".connector-filter")) {
      button.setAttribute(
        "aria-pressed",
        String(connectors.includes(button.dataset.connectorGroup))
      );
    }
    this.filtersChanged();
  }

  // The car's automatic filter (the account menu's car setting): with it
  // on, only chargers the car can use show, on the map and on routes.
  applyCarFilter() {
    const { connectors, autoFilter } = chosenCar();
    if (!autoFilter || !connectors.length) {
      return;
    }
    for (const button of this.querySelectorAll(".connector-filter")) {
      button.setAttribute(
        "aria-pressed",
        String(connectors.includes(button.dataset.connectorGroup))
      );
    }
    this.filtersChanged();
  }

  carChanged() {
    this.updateCarFilterButton();
    this.applyCarFilter();
  }

  // "My car" shows once the car has connectors; it looks pressed while
  // exactly its connectors are selected.
  updateCarFilterButton() {
    const button = this.querySelector(".car-filter");
    if (!button) {
      return;
    }
    const { connectors } = chosenCar();
    button.hidden = connectors.length === 0;
    const active = this.activeConnectorGroups().sort();
    button.setAttribute(
      "aria-pressed",
      String(
        connectors.length > 0 &&
          active.length === connectors.length &&
          active.every((group, index) => group === [...connectors].sort()[index])
      )
    );
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
      this.availableChargers = [];
      this.listOperators([]);
      this.hideChargerDetails();
      this.setStatus(message("zoomIn"), "warning");
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
    if (this.indexedChargers !== chargers) {
      this.indexedChargers = chargers;
      this.chargersById = new Map(chargers.map((charger) => [charger.id, charger]));
      this.chargerIndex.setChargers(chargers);
    }
    const { matching: matchingIds, available: availableIds } = await this.chargerIndex.filter({
      ranges: this.filterPanel ? readActivePowerRanges(this.filterPanel) : [],
      connectorTypes: this.filterPanel ? [...readActiveConnectorTypes(this.filterPanel)] : [],
      excludedOperators: [...this.excludedOperators],
      favoriteIds: this.onlyFavorites()
        ? chargers.filter((charger) => isFavorite(charger.id)).map((charger) => charger.id)
        : null,
      // "Hide unavailable": the chargers the live statuses say are full.
      unavailableIds: this.hideUnavailable()
        ? chargers.filter((charger) => !this.isAvailable(charger)).map((charger) => charger.id)
        : [],
      amenities: this.activeAmenities(),
      priceLevels: this.activePriceLevels().map(Number),
    });
    // A newer load replaced these chargers while they were filtered.
    if (this.loaded?.chargers !== chargers) {
      return;
    }
    // The operators are listed by what every other filter leaves.
    const available = availableIds.map((id) => this.chargersById.get(id));
    this.availableChargers = available;
    this.listOperators(chargers, available);
    const matching = matchingIds.map((id) => this.chargersById.get(id));
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

  // How the list is sorted along a route: "start", "end" or "route".
  get sortBy() {
    const checked = this.chargerList?.querySelector('input[name="sort-by"]:checked');
    return checked?.value ?? "start";
  }

  set sortBy(by) {
    const input = this.chargerList?.querySelector(`input[name="sort-by"][value="${by}"]`);
    if (input) {
      input.checked = true;
    }
  }

  sortByLabel() {
    return message(`sortBy_${this.sortBy}`);
  }

  // Along a route, a listed charger's distances, each saying what it is:
  // from the start, to the end and off the route, drawn as a node graph:
  // the start node, a bend in the road branching off to the charger's pin
  // with the +X km / m detour next to it, and the end node.
  fillRouteDistances(element, route) {
    element.hidden = false;
    const fromStart = formatDistance(route.distanceFromStartMeters);
    const toEnd =
      route.distanceToEndMeters != null ? formatDistance(route.distanceToEndMeters) : null;
    const offRoute = formatDistance(route.distanceFromRouteMeters);
    const texts = [
      message("fromStart", { distance: fromStart }),
      toEnd && message("toEnd", { distance: toEnd }),
      message("offRoute", { distance: offRoute }),
    ].filter(Boolean);
    const along = route.distanceFromStartMeters + (route.distanceToEndMeters ?? 0);
    // Where the charger sits along the route, 0 to 1; without the end's
    // distance, in the middle.
    const position = route.distanceToEndMeters ? route.distanceFromStartMeters / along : 0.5;
    const ratio = Math.min(Math.max(position, 0), 1);
    const pct = `${ratio * 100}%`;

    const visual = this.cloneTemplate(".route-visual-template");
    visual.style.setProperty("--route-ratio", String(ratio));
    visual.style.setProperty("--route-progress", pct);
    visual.querySelector(".route-visual-bend").dataset.progress = pct;
    visual.querySelector(".route-visual-distance.start").textContent = fromStart;
    visual.querySelector(".route-visual-detour").textContent = `+${offRoute}`;
    const endEl = visual.querySelector(".route-visual-distance.end");
    endEl.textContent = toEnd ?? "";
    endEl.hidden = !toEnd;
    visual.setAttribute("aria-label", texts.join(", "));
    visual.title = texts.join("\n");
    element.replaceChildren(visual);
  }

  // Where a charger's price sits among the loaded chargers (the map's or the
  // route's); the comparison is built once for each set of them.
  pricinessOf(charger) {
    const chargers = this.loaded?.chargers ?? [];
    if (this.pricinessFor?.chargers !== chargers) {
      this.pricinessFor = { chargers, of: pricinessAmong(chargers) };
    }
    return this.pricinessFor.of(charger);
  }

  // Lists the chargers in order along the route, or nearest first: to the
  // user if they've been located, otherwise to the center of the map.
  renderChargerList() {
    const origin = this.userLocation ?? this.map.getCenter().toJSON();
    const keyOf = (charger) =>
      this.route
        ? this.sortBy === "end"
          ? charger.route.distanceToEndMeters
          : this.sortBy === "route"
            ? charger.route.distanceFromRouteMeters
            : charger.route.distanceFromStartMeters
        : distanceInMeters(origin, charger.location);
    this.sortedChargers = this.listedChargers
      .map((charger) => ({ charger, meters: keyOf(charger) }))
      .sort((a, b) => a.meters - b.meters);

    const list = this.chargerList;
    const count = this.sortedChargers.length;
    list.querySelector(".title").textContent = message("chargerCount", { count });
    const sortOptions = list.querySelector(".sort-options");
    sortOptions.hidden = !this.route;
    list.querySelector(".sort-basis").textContent = this.route
      ? message("sortedBy", { by: this.sortByLabel() })
      : message(this.userLocation ? "nearestToYou" : "nearestToCenter");

    const template = list.querySelector(".item-template");
    list.querySelector(".items").replaceChildren(
      ...this.sortedChargers.map(({ charger, meters }, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".entry").dataset.index = String(index);
        item.querySelector(".name").textContent = chargerName(charger);
        if (this.route) {
          this.fillRouteDistances(item.querySelector(".route-distances"), charger.route);
        } else {
          item.querySelector(".distance").textContent = formatDistance(meters);
        }
        const price = describePriciness(this.pricinessOf(charger));
        item.querySelector(".meta").textContent = [
          charger.maxPowerKw ? message("power", { power: charger.maxPowerKw }) : null,
          // Compared with the loaded chargers, e.g. the route's.
          price && message("pricinessShort", { scale: price.scale }),
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
  // `record`: put it in the user's route history, with the filters on now
  // (not for a route restored after a reload).
  // `corridorKm`: how far from the route chargers are shown.
  async showRoute({ origin, destination, stops = [], corridorKm = CORRIDOR_KM, record = false }) {
    await this.mapReady;
    // A newer route replaces this one; the map's own loads don't, but this
    // cancels theirs.
    const routeId = ++this.routeId;
    ++this.searchId;
    this.setStatus(message("routeLoading"), "loading");
    try {
      const plan = await this.planRoute({ origin, destination, stops, corridorKm });
      if (routeId !== this.routeId) {
        return;
      }
      if (!plan) {
        this.setStatus(message("noRoute"), "error");
        return;
      }
      const ends = {
        origin: savedEnd(origin),
        destination: savedEnd(destination),
        stops: stops.map(savedEnd),
      };
      await this.drawRoute(ends, corridorKm, plan);
      if (record) {
        const { updatedAt: _, ...filters } = this.currentFilters();
        recordRoute({
          origin: ends.origin,
          destination: ends.destination,
          ...(ends.stops.length ? { stops: ends.stops } : {}),
          filters,
          corridorKm,
          plannedAt: Date.now(),
        }).catch((error) => console.error("Could not save the route history:", error));
      }
    } catch (error) {
      console.error("Could not plan the route:", error);
      if (routeId === this.routeId) {
        this.setStatus(message(navigator.onLine ? "routeFailed" : "offlineChargers"), "error");
      }
    }
  }

  // The route between the ends (as the Routes library takes them), and the
  // chargers along it: { path, stopDistances, chargers, full, plannedAt }, or
  // null when there's no route.
  async planRoute({ origin, destination, stops, corridorKm }) {
    const { Route } = await this.maps.importLibrary("routes");
    const { routes } = await Route.computeRoutes({
      origin: routeEndpoint(origin),
      destination: routeEndpoint(destination),
      ...(stops.length ? { intermediates: stops.map(routeEndpoint) } : {}),
      travelMode: "DRIVING",
      // `legs` for the distance into each stop along the route.
      fields: ["path", "legs"],
      language: document.documentElement.lang,
    });
    const path = routes?.[0]?.path?.map(toLatLng);
    if (!path?.length) {
      return null;
    }
    const { chargers, full } = await fetchChargersAlongRoute(path, corridorKm);
    return {
      path,
      // Leg 0 runs to the first stop, leg 1 to the second, and so on, the
      // last to the destination; the planner shows each between its points.
      stopDistances: (routes[0].legs ?? []).map((leg) => leg.distanceMeters),
      chargers,
      full,
      plannedAt: Date.now(),
    };
  }

  // Shows a planned route: its line, the chargers along it, its legs in the
  // planner; and saves it with its plan, so a reload shows it at once.
  // `ends` are saved ends ({ label, placeId } or { label, location });
  // `fit`: zoom the map to it (not when a background refresh redraws it).
  async drawRoute(ends, corridorKm, plan, { fit = true } = {}) {
    const { Polyline } = await this.maps.importLibrary("maps");
    this.removeRouteLine();
    const colors = this.routeColors;
    const { path } = plan;
    this.route = {
      casing: new Polyline({ ...ROUTE_CASING, path, map: this.map, strokeColor: colors.casing }),
      line: new Polyline({ ...ROUTE_LINE, path, map: this.map, strokeColor: colors.line }),
      path,
    };
    this.loaded = { chargers: plan.chargers, truncated: plan.full };
    this.setRouteShown(true);
    this.routePlanner?.setRoute(
      { origin: ends.origin, destination: ends.destination, corridorKm },
      plan.stopDistances
    );
    if (fit) {
      this.hideChargerDetails();
      this.map.fitBounds(pathBounds(path), this.routePadding());
    }
    saveRoute({
      origin: ends.origin,
      destination: ends.destination,
      ...(ends.stops.length ? { stops: ends.stops } : {}),
      corridorKm,
      plan,
    });
    await this.showMatchingChargers();
  }

  // Plans a route shown from its saved plan again, quietly: the user keeps
  // the saved one meanwhile, and gets the new one only if it differs (roads,
  // chargers, their places change). Failing, the saved one stays.
  async refreshRoute(routeId, places, ends, corridorKm, saved) {
    try {
      const plan = await this.planRoute({ ...places, corridorKm });
      if (!plan || routeId !== this.routeId) {
        return;
      }
      if (samePlan(saved, plan)) {
        saveRoute({
          origin: ends.origin,
          destination: ends.destination,
          ...(ends.stops.length ? { stops: ends.stops } : {}),
          corridorKm,
          plan,
        });
        return;
      }
      await this.drawRoute(ends, corridorKm, plan, { fit: false });
    } catch (error) {
      console.warn("Could not refresh the route:", error);
    }
  }

  // A saved route's ends as the Routes library takes them: a Google place
  // rebuilt from its ID, or a location.
  async routeEnds({ origin, destination, stops = [] }) {
    await this.mapReady;
    const { Place } = await this.maps.importLibrary("places");
    const toEnd = ({ id, label, placeId, location }) =>
      placeId
        ? { label, place: new Place({ id: placeId }) }
        : { ...(id ? { id } : {}), label, location };
    return {
      origin: toEnd(origin),
      destination: toEnd(destination),
      stops: stops.map(toEnd),
    };
  }

  // A route from the history: its filters back on, then the route planned
  // again, and moved to the top of the history.
  async showRouteFromHistory(route) {
    this.applyFilters({ ...route.filters, updatedAt: Date.now() });
    this.filtersChanged();
    const { origin, destination, stops } = await this.routeEnds(route);
    // Routes saved before the distance could be chosen have none: the default.
    const corridorKm = route.corridorKm ?? CORRIDOR_KM;
    this.routePlanner?.setPlaces(origin, destination, corridorKm, stops);
    await this.showRoute({ origin, destination, stops, corridorKm, record: true });
  }

  // Shows the route saved before a reload again, once per page, and its
  // places in the route planner.
  async restoreRoute() {
    if (this.routeRestored) {
      return;
    }
    this.routeRestored = true;
    // A shared link's route first: it wins over the one saved on this device,
    // and the query is dropped, so a reload plans the saved route instead.
    const shared = routeFromUrl();
    if (shared) {
      window.history.replaceState(null, "", window.location.pathname);
      const { origin, destination } = await this.routeEnds(shared);
      const corridorKm = shared.corridorKm ?? CORRIDOR_KM;
      this.routePlanner?.setPlaces(origin, destination, corridorKm);
      await this.showRoute({ origin, destination, corridorKm });
      return;
    }
    const saved = await readRoute();
    if (!saved || this.route) {
      return;
    }
    await this.mapReady;
    const { origin, destination, stops } = await this.routeEnds(saved);
    const corridorKm = saved.corridorKm ?? CORRIDOR_KM;
    this.routePlanner?.setPlaces(origin, destination, corridorKm, stops);
    // Planned not long ago: shown at once from what was saved, no waiting
    // on planning it again; past a while, planned again in the background.
    const state = planState(saved.plan);
    if (state === "expired") {
      await this.showRoute({ origin, destination, stops, corridorKm });
      return;
    }
    const routeId = ++this.routeId;
    ++this.searchId;
    const ends = {
      origin: saved.origin,
      destination: saved.destination,
      stops: saved.stops ?? [],
    };
    await this.drawRoute(ends, corridorKm, saved.plan);
    if (state === "stale" && routeId === this.routeId) {
      this.refreshRoute(routeId, { origin, destination, stops }, ends, corridorKm, saved.plan);
    }
  }

  clearRoute() {
    saveRoute(null);
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

  // The route in the current theme's colors.
  recolorRoute() {
    if (!this.route) {
      return;
    }
    const colors = this.routeColors;
    this.route.casing.setOptions({ strokeColor: colors.casing });
    this.route.line.setOptions({ strokeColor: colors.line });
  }

  removeRouteLine() {
    this.route?.casing.setMap(null);
    this.route?.line.setMap(null);
  }

  setRouteShown(shown) {
    if (this.clearRouteButton) {
      this.clearRouteButton.hidden = !shown;
    }
    if (this.zoomRouteButton) {
      this.zoomRouteButton.hidden = !shown;
    }
    this.routePlanner?.setRouteShown(shown);
  }

  // Lets the user drop a pin: the map, from `near` (zoomed in) or where it
  // is, moves under a pin fixed in its middle. Escape cancels.
  async pickLocation({ near } = {}) {
    await this.mapReady;
    if (near) {
      this.map.setCenter(near);
      this.map.setZoom(PICK_ZOOM);
    }
    this.picker = this.querySelector(".pick-location");
    this.picker.hidden = false;
    this.classList.add("picking");
    this.pickEscape = (event) => {
      if (event.key === "Escape") {
        // Its default would close the dialog this hands the answer back to.
        event.preventDefault();
        this.finishPicking(null);
      }
    };
    document.addEventListener("keydown", this.pickEscape);
    this.querySelector(".pick-confirm").focus();
  }

  // Hands the spot (or null, cancelled) back to whoever asked for it.
  finishPicking(location) {
    if (!this.picker || this.picker.hidden) {
      return;
    }
    this.picker.hidden = true;
    this.classList.remove("picking");
    document.removeEventListener("keydown", this.pickEscape);
    document.dispatchEvent(
      new CustomEvent("map-location-picked", { detail: location ? { location } : null })
    );
  }

  // The route's padding in the map: past what floats over the map's top (the
  // account menu, the status pill) and bottom (the map controls), so they
  // don't cover the route's ends.
  routePadding() {
    const map = this.mapEl?.getBoundingClientRect();
    if (!map?.height) {
      return ROUTE_PADDING;
    }
    const shown = (selector) =>
      [...document.querySelectorAll(selector)]
        .map((element) => element.getBoundingClientRect())
        .filter((box) => box.width && box.height);
    const header = shown(".user-menu .bar, .map-status");
    const footer = shown(".map-controls");
    const top = Math.max(map.top, ...header.map((box) => box.bottom)) - map.top;
    const bottom = map.bottom - Math.min(map.bottom, ...footer.map((box) => box.top));
    return {
      top: top + ROUTE_PADDING,
      bottom: bottom + ROUTE_PADDING,
      left: ROUTE_PADDING,
      right: ROUTE_PADDING,
    };
  }

  // Zooms out (or in) so the whole shown route is in view again, e.g. after
  // panning away to a charger along it.
  zoomToRoute() {
    if (this.route?.path) {
      this.map?.fitBounds(pathBounds(this.route.path), this.routePadding());
    }
  }

  // The route's colors, design tokens (--color-route and
  // --color-route-casing in global.css) for the current theme. They're
  // light-dark() values, which only a real property resolves, so each is
  // read as the color of a probe element.
  get routeColors() {
    const probe = document.createElement("span");
    probe.hidden = true;
    this.append(probe);
    const colorOf = (variable) => {
      probe.style.color = `var(${variable})`;
      return getComputedStyle(probe).color;
    };
    const colors = { line: colorOf("--route-color"), casing: colorOf("--route-casing-color") };
    probe.remove();
    return colors;
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

  // Whether "Hide unavailable" is pressed; it only applies signed in, as
  // live statuses do.
  availabilityFilterPressed() {
    return this.querySelector(".availability-filter")?.getAttribute("aria-pressed") === "true";
  }

  hideUnavailable() {
    return isSignedIn() && this.availabilityFilterPressed();
  }

  // False while the live statuses say none of the charger's points is free;
  // chargers without statuses are kept, as nothing says they're taken.
  isAvailable(charger) {
    return noneFree(this.cachedStatuses(liveStatusIds(charger))) !== true;
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
      ".favorite-button, .favorites-filter, .availability-filter, .nearby-filter"
    )) {
      button.setAttribute("aria-disabled", String(!signedIn));
    }
    for (const hint of this.querySelectorAll(
      "#favorite-sign-in-hint, #favorites-filter-hint, #availability-filter-hint, #nearby-filter-hint"
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
    this.map.setZoom(await this.unclusteredZoom(charger));
    this.centerInVisibleArea(charger.location);
  }

  async showChargerFromList(charger) {
    await this.closeChargerList();
    this.displayChargerDetails(charger);
    this.map.setZoom(await this.unclusteredZoom(charger));
    this.centerInVisibleArea(charger.location);
  }

  // The lowest zoom (at least LIST_ZOOM) at which the charger has its own pin
  // instead of being part of a cluster.
  unclusteredZoom(charger) {
    const fromZoom = Math.max(Math.floor(this.map.getZoom()), LIST_ZOOM);
    return this.chargerIndex.unclusteredZoom(charger, fromZoom);
  }

  // Centers a location in the part of the map the details panel leaves
  // visible: above the bottom sheet on small screens, right of the side
  // panel otherwise. Uses layout offsets, as the panel may still be sliding
  // in with a transform.
  // Whether the details panel covers a location's pin. The pin's place in
  // the map comes from the map's center and zoom (Web Mercator, as Google
  // Maps draws it); the panel's from its layout, as it may still be sliding
  // in with a transform.
  isCoveredByDetails(location) {
    const panel = this.detailsPanel;
    const container = panel?.offsetParent;
    if (!panel || panel.hidden || !container || !this.map) {
      return false;
    }
    const zoom = this.map.getZoom();
    const center = worldPixel(this.map.getCenter().toJSON(), zoom);
    const point = worldPixel(location, zoom);
    const x = point.x - center.x + container.clientWidth / 2;
    const y = point.y - center.y + container.clientHeight / 2;
    // The pin stands above its location.
    const pin = { left: x - PIN_SIZE / 2, right: x + PIN_SIZE / 2, top: y - PIN_SIZE, bottom: y };
    return (
      pin.right > panel.offsetLeft &&
      pin.left < panel.offsetLeft + panel.offsetWidth &&
      pin.bottom > panel.offsetTop &&
      pin.top < panel.offsetTop + panel.offsetHeight
    );
  }

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
    // The charger as last loaded: a pin kept across loads (renderMarkers)
    // shows the newer copy, e.g. a route's, with its distances along it.
    marker.addEventListener("gmp-click", () => {
      const shown = this.chargersByMarker.get(marker) ?? charger;
      this.setActiveMarker(marker);
      this.displayChargerDetails(shown);
      // The details mustn't cover the pin they're about.
      if (this.isCoveredByDetails(shown.location)) {
        this.centerInVisibleArea(shown.location);
      }
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
  // With "Hide unavailable", also the statuses of the loaded chargers in
  // view that it hides, so they come back once a point is free; and the
  // chargers are filtered again when new statuses came in.
  async showPinAvailability() {
    const markers = [...this.markersById.values()].filter((marker) =>
      this.chargersByMarker.has(marker)
    );
    const before = this.statusesVersion;
    if (isSignedIn()) {
      const bounds = this.map?.getBounds()?.toJSON();
      const shown = markers.map((marker) => this.chargersByMarker.get(marker));
      const hidden =
        this.hideUnavailable() && bounds
          ? (this.loaded?.chargers ?? []).filter((charger) => isInBounds(charger.location, bounds))
          : [];
      const ids = [...shown, ...hidden].flatMap(liveStatusIds);
      try {
        await this.loadStatuses(ids);
      } catch (error) {
        console.error("Could not load the chargers' availability:", error);
      }
    }
    for (const marker of markers) {
      this.showMarkerAvailability(marker);
    }
    if (this.statusesVersion !== before && this.hideUnavailable()) {
      await this.showMatchingChargers();
    }
  }

  createClusterMarker(AdvancedMarkerElement, cluster) {
    const { clusterId, count } = cluster;
    const [lng, lat] = cluster.coordinates;
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
    marker.clusterId = clusterId;
    this.showClusterFavorite(marker);
    marker.addEventListener("gmp-click", async () => {
      this.map.setCenter({ lat, lng });
      this.map.setZoom(await this.chargerIndex.expansionZoom(clusterId));
    });
    return marker;
  }

  // A cluster wears the favorite design when any charger in it is one of
  // the user's favorites.
  async showClusterFavorite(marker) {
    const favoriteIds = [...this.chargersById.keys()].filter((id) => isFavorite(id));
    const favorite =
      favoriteIds.length > 0 && (await this.chargerIndex.clusterHas(marker.clusterId, favoriteIds));
    marker.content?.classList.toggle("favorite", favorite);
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
    const features = (await this.chargerIndex.clusters([west, south, east, north], zoom)).filter(
      (feature) => feature.clusterId != null || this.chargersById.has(feature.chargerId)
    );

    const featuresByKey = new Map(
      features.map((feature) => [
        feature.clusterId != null
          ? `cluster:${zoom}:${feature.clusterId}`
          : `charger:${feature.chargerId}`,
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
      // A charger's pin kept from before takes its newer copy, and its
      // place: the same charger can be elsewhere in the next set, e.g. a
      // route's with its distances.
      const kept = this.markersById.get(key);
      if (kept && feature.clusterId == null) {
        const charger = this.chargersById.get(feature.chargerId);
        this.chargersByMarker.set(kept, charger);
        if (charger && kept.position?.lat !== charger.location.lat) {
          kept.position = charger.location;
        }
      }
      if (!kept) {
        this.markersById.set(
          key,
          feature.clusterId != null
            ? this.createClusterMarker(AdvancedMarkerElement, feature)
            : this.createChargerMarker(
                AdvancedMarkerElement,
                this.chargersById.get(feature.chargerId)
              )
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

  // Renders each connector group as a compact column card with its standard
  // plug diagram, power and quantity, an `i` info button that reveals the
  // connector name on hover/focus, and a row of point indicators (up to 12)
  // that show free (green), occupied (yellow) or out-of-service (red) once
  // live availability loads.
  renderConnectors(connectors) {
    const list = this.detailsPanel.querySelector(".connectors");
    const cardTemplate = this.detailsPanel.querySelector(".connector-card-template");
    const pointTemplate = this.detailsPanel.querySelector(".connector-point-template");
    list.classList.remove("has-free", "none-free", "all-occupied", "out-of-service");
    list.replaceChildren(
      ...connectors.map((connector, index) => {
        const card = cardTemplate.content.firstElementChild.cloneNode(true);
        const typeLabel = valueLabel("connectors", connector.type);
        const summary = formatConnector(connector);
        const tooltip = card.querySelector(".connector-tooltip");
        const tooltipId = `connector-tooltip-${index}`;
        tooltip.id = tooltipId;
        tooltip.textContent = typeLabel;
        const infoBtn = card.querySelector(".connector-info");
        infoBtn.setAttribute("aria-label", summary);
        infoBtn.setAttribute("aria-describedby", tooltipId);
        const diagram = card.querySelector(
          `.connector-diagram[data-diagram="${connectorDiagram(connector.type)}"]`
        );
        if (diagram) {
          diagram.hidden = false;
        }
        card.querySelector(".connector-power").textContent = connector.powerKw
          ? message("power", { power: connector.powerKw })
          : "";
        card.querySelector(".connector-qty").textContent = `${connector.quantity ?? 1}×`;
        // Says why the points stay grey until (or unless) live availability
        // colors them: the caption shows only while the card has no live state.
        card.querySelector(".connector-no-status").textContent = message("noLiveStatus");
        const count = Math.min(Math.max(connector.quantity ?? 1, 1), 12);
        card
          .querySelector(".connector-points")
          .replaceChildren(
            ...Array.from({ length: count }, () =>
              pointTemplate.content.firstElementChild.cloneNode(true)
            )
          );
        return card;
      })
    );
  }

  // Colors the connector cards and their individual point pills according to
  // the live availability counts: green (`free`), yellow (`occupied`), or
  // red (`out-of-service`).
  colorConnectors(connectorsList, { available, occupied, outOfService, total }) {
    const cards = [...connectorsList.querySelectorAll(".connector-card")];
    const points = [...connectorsList.querySelectorAll(".connector-point")];
    const state =
      available > 0 ? "free" : outOfService > 0 && occupied === 0 ? "out-of-service" : "occupied";
    connectorsList.classList.add(
      available > 0 ? "has-free" : "none-free",
      ...(state === "out-of-service"
        ? ["out-of-service"]
        : state === "occupied"
          ? ["all-occupied"]
          : [])
    );
    if (!points.length || total <= 0) {
      for (const card of cards) {
        // Without counts the points stay grey: unknown, not occupied.
        card.dataset.state = "unknown";
      }
      return;
    }
    const freeDots =
      available > 0
        ? Math.min(points.length, Math.max(1, Math.round((available / total) * points.length)))
        : 0;
    const outDots =
      outOfService > 0
        ? Math.min(
            points.length - freeDots,
            Math.max(1, Math.round((outOfService / total) * points.length))
          )
        : 0;
    for (const [index, point] of points.entries()) {
      point.dataset.state =
        index < freeDots
          ? "free"
          : index >= points.length - outDots
            ? "out-of-service"
            : "occupied";
    }
    for (const card of cards) {
      const cardPoints = [...card.querySelectorAll(".connector-point")];
      card.dataset.state = cardPoints.some((p) => p.dataset.state === "free")
        ? "free"
        : cardPoints.every((p) => p.dataset.state === "out-of-service")
          ? "out-of-service"
          : "occupied";
    }
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
    this.showOpenInMaps(charger);
    // A charger of the route shown: where it is along it.
    const routeDistances = panel.querySelector(".route-distances");
    if (this.route && charger.route) {
      this.fillRouteDistances(routeDistances, charger.route);
    } else {
      routeDistances.hidden = true;
    }
    this.renderConnectors(charger.connectors);
    const details = formatDetails(charger);
    // Where the price sits among the loaded chargers, e.g. "Priciness: $$
    // (pricier than 78% of the chargers here)"; only per-kWh and comparable.
    const price = describePriciness(this.pricinessOf(charger));
    if (price) {
      details.push(message("priciness", { scale: price.scale, comparison: price.comparison }));
    }
    this.fillList(panel.querySelector(".details"), details);
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
    this.showRouteStopState(charger);
    this.showAvailability(charger);
  }

  // Whether the open charger is one of the route's stops.
  showRouteStopState(charger) {
    const button = this.detailsPanel?.querySelector(".add-to-route");
    if (!button) {
      return;
    }
    const added = Boolean(
      charger &&
      this.routePlanner?.hasStop({
        id: charger.id,
        label: chargerName(charger),
        location: charger.location,
      })
    );
    button.setAttribute("aria-pressed", String(added));
    button.querySelector(".label").textContent = added
      ? button.dataset.removeLabel
      : button.dataset.addLabel;
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
      this.statusesVersion = (this.statusesVersion ?? 0) + 1;
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

  // Signed out, the availability asks to sign in instead of showing statuses.
  showAvailabilitySignIn(section, signInNeeded) {
    for (const element of section.querySelectorAll(".free, .out-of-service, .updated")) {
      element.hidden = signInNeeded;
    }
    section.querySelector(".sign-in-needed").hidden = !signInNeeded;
    section.querySelector(".sign-in-button").hidden = !signInNeeded;
  }

  // How many of the charger's points are free right now, where a source
  // publishes it; shown in the connectors section, and its chips colored
  // green when a point is free, red when none is. It needs a signed-in user
  // (the Worker says 401 otherwise).
  async showAvailability(charger) {
    const section = this.detailsPanel.querySelector(".connectors-section");
    const availability = section.querySelector(".availability-status");
    const connectorsList = section.querySelector(".connectors");
    availability.hidden = true;
    connectorsList.classList.remove("has-free", "none-free", "all-occupied", "out-of-service");
    for (const el of connectorsList.querySelectorAll(".connector-card, .connector-point")) {
      delete el.dataset.state;
    }
    const ids = liveStatusIds(charger);
    if (!ids.length) {
      return;
    }
    if (!isSignedIn()) {
      this.showAvailabilitySignIn(section, true);
      availability.hidden = false;
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
      availability.hidden = false;
      return;
    }
    if (!statuses.length) {
      return;
    }
    this.showAvailabilitySignIn(section, false);
    const sum = (field) => statuses.reduce((total, status) => total + status[field], 0);
    const available = sum("available");
    const occupied = sum("occupied");
    const outOfService = sum("outOfService");
    const total = sum("total");
    section.querySelector(".free").textContent = message("pointsFree", {
      available,
      count: total,
    });
    const outOfServiceEl = section.querySelector(".out-of-service");
    outOfServiceEl.textContent = message("pointsOutOfService", { count: outOfService });
    outOfServiceEl.hidden = outOfService === 0;
    section.querySelector(".updated").textContent = message("statusUpdated", {
      time: minutesAgo(Math.min(...statuses.map((status) => status.updatedAt))),
    });
    availability.hidden = false;
    this.colorConnectors(connectorsList, { available, occupied, outOfService, total });
  }

  // Closed by the user (the close button, Escape): it slides out. Other
  // flows hide it at once, as they may show another charger right after.
  closeChargerDetails() {
    withViewTransition(() => this.hideChargerDetails());
  }

  // "Open in maps": the remembered app at once, else the list of apps to
  // choose from, which can remember the choice (src/lib/maps-app.js). The
  // app is opened in the click itself, so it isn't blocked as a popup.
  setupOpenInMaps() {
    const panel = this.detailsPanel;
    const button = panel?.querySelector(".open-in-maps");
    if (!button) {
      return;
    }
    const apps = panel.querySelector(".maps-apps");
    // "Open in maps", as the page was built, for when no app is remembered.
    this.openInMapsLabel = button.querySelector(".label").textContent.trim();
    button.addEventListener("click", () => {
      const app = mapsApp();
      if (app && this.activeCharger) {
        window.open(
          mapsAppUrl(app, this.activeCharger.location, chargerName(this.activeCharger)),
          "_blank",
          "noopener"
        );
        return;
      }
      this.setMapsAppsExpanded(apps.hidden);
    });
    apps.addEventListener("click", (event) => {
      const link = event.target.closest(".app");
      if (!link) {
        return;
      }
      if (apps.querySelector(".remember-app").checked) {
        setMapsApp(link.dataset.app);
      }
      this.setMapsAppsExpanded(false);
    });
    // Remembered or forgotten here or in the account menu.
    onMapsAppChange(() => this.activeCharger && this.showOpenInMaps(this.activeCharger));
  }

  // The button for the remembered app ("Open in Google Maps"), or for the
  // list; the apps' links go to this charger.
  showOpenInMaps(charger) {
    const panel = this.detailsPanel;
    const button = panel?.querySelector(".open-in-maps");
    if (!button) {
      return;
    }
    const app = mapsApp();
    button.querySelector(".label").textContent = app
      ? message("openInApp", { app: valueLabel("mapsApps", app) })
      : this.openInMapsLabel;
    if (app) {
      button.removeAttribute("aria-expanded");
    }
    for (const link of panel.querySelectorAll(".maps-apps .app")) {
      link.href = mapsAppUrl(link.dataset.app, charger.location, chargerName(charger));
    }
    panel.querySelector(".remember-app").checked = false;
    this.setMapsAppsExpanded(false);
  }

  setMapsAppsExpanded(expanded) {
    const panel = this.detailsPanel;
    const button = panel.querySelector(".open-in-maps");
    panel.querySelector(".maps-apps").hidden = !expanded;
    if (!mapsApp()) {
      button.setAttribute("aria-expanded", String(expanded));
    }
  }

  // Moves the map to a place found in the place search, at the located zoom.
  async showPlace({ location }) {
    await this.mapReady;
    this.map.setCenter(location);
    this.map.setZoom(this.locatedZoom);
    await this.loadEvChargers();
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
