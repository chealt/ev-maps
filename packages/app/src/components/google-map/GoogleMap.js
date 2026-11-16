import Supercluster from "supercluster";
import { fetchChargersInBounds } from "./chargers.js";
import { loadGoogleMaps } from "./loader.js";
import { readFilters, readMapView, saveFilters, saveMapView } from "./saved-state.js";

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

const formatConnector = ({ type, powerKw, quantity }) => {
  const power = powerKw ? ` · ${powerKw} kW` : "";
  return `${type}: ${quantity ?? 1}×${power}`;
};

const formatDetails = ({ operator, usageType, usageCost, status, numberOfPoints }) =>
  [
    operator && `Operator: ${operator}`,
    usageType && `Access: ${usageType}`,
    usageCost && `Cost: ${usageCost}`,
    status && `Status: ${status}`,
    numberOfPoints && `Charging points: ${numberOfPoints}`,
  ].filter(Boolean);

const EARTH_RADIUS_METERS = 6371000;
const LIST_ZOOM = 15;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle (haversine) distance between two { lat, lng } points.
const distanceInMeters = (from, to) => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

const formatDistance = (meters) =>
  meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs a DOM update as a view transition where supported and wanted.
const withViewTransition = (update) => {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
};

const toFeature = (charger) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [charger.location.lng, charger.location.lat] },
  properties: { charger },
});

const chargerCountMessage = ({ shown, total, filtered, truncated }) => {
  if (!total) {
    return "No EV chargers in this area";
  }
  if (filtered) {
    return `${shown} of ${total} EV chargers match the filters`;
  }
  if (truncated) {
    return `Showing ${total} EV chargers, zoom in to see all`;
  }
  return `${total} EV chargers found`;
};

// The active power filter buttons' ranges: [minKw, maxKw).
const readActivePowerRanges = (panel) =>
  [...panel.querySelectorAll('.power-filter[aria-pressed="true"]')].map((button) => ({
    minKw: Number(button.dataset.minKw),
    maxKw: button.dataset.maxKw ? Number(button.dataset.maxKw) : Infinity,
  }));

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
  searchId = 0;
  mapReady = new Promise((resolve) => {
    this.resolveMapReady = resolve;
  });

  handleThemeChange = () => this.recreateMap();

  connectedCallback() {
    this.statusButton = this.querySelector(".map-status");
    this.statusEl = this.statusButton?.querySelector(".text");
    this.chargerList = this.querySelector(".charger-list");
    this.mapEl = this.querySelector(".google-map");
    this.filterPanel = this.querySelector(".filter-dialog");
    this.detailsPanel = this.querySelector(".charger-details");

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
          this.setStatus("Failed to load Google Maps", "error");
        } else {
          this.setStatus("You're offline. The map will load when you're back online.");
          window.addEventListener("online", () => this.loadMap(apiKey), { once: true });
        }
      });
  }

  disconnectedCallback() {
    document.removeEventListener("theme-change", this.handleThemeChange);
  }

  get locatedZoom() {
    return Number(this.dataset.locatedZoom) || 14;
  }

  get minChargerZoom() {
    return Number(this.dataset.minChargerZoom) || 9;
  }

  setupEventListeners() {
    this.addEventListener("locate-start", () => this.setStatus("Locating...", "loading"));
    this.addEventListener("location-found", (event) => this.handleLocationFound(event));
    this.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || "Unable to determine your location", "error")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());
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

    this.detailsPanel
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.hideChargerDetails());
    this.filterPanel?.addEventListener("click", (event) => this.handleFilterClick(event));
    for (const button of this.querySelectorAll(".clear-filters")) {
      button.addEventListener("click", () => this.clearFilters());
    }
    for (const button of this.filterPanel?.querySelectorAll(".close, .done") ?? []) {
      button.addEventListener("click", () => this.filterPanel.close());
    }
    // However the dialog closes (buttons, Escape), the Filters button follows.
    this.filterPanel?.addEventListener("close", () =>
      this.querySelector(".filter-button")?.setAttribute("aria-expanded", "false")
    );
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
      this.setStatus("You're offline. The map will load when you're back online.");
      window.addEventListener("online", () => this.initMap(maps), { once: true });
      return;
    }
    const { Map } = await maps.importLibrary("maps");
    this.maps = maps;
    this.MapClass = Map;
    const savedView = await readMapView();
    this.createMap({
      center: savedView?.center ?? {
        lat: Number(this.dataset.centerLat) || 0,
        lng: Number(this.dataset.centerLng) || 0,
      },
      zoom: savedView?.zoom ?? (savedView ? this.locatedZoom : Number(this.dataset.zoom) || 12),
    });
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
    for (const marker of this.markersById.values()) {
      marker.map = this.map;
    }
  }

  async handleLocationFound(event) {
    const { lat, lng } = event.detail;
    this.userLocation = { lat, lng };
    this.setStatus(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

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
    const button = event.target.closest(".power-filter");
    if (!button) {
      return;
    }
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    this.filtersChanged();
  }

  clearFilters() {
    for (const button of this.querySelectorAll(".power-filter")) {
      button.setAttribute("aria-pressed", "false");
    }
    this.filtersChanged();
  }

  filtersChanged() {
    saveFilters({ powerRanges: this.activePowerRanges() });
    this.updateClearFiltersButtons();
    this.showMatchingChargers();
  }

  // "Clear filters" shows on the map and is enabled in the dialog only while
  // a filter is active.
  updateClearFiltersButtons() {
    const active = this.activePowerRanges().length > 0;
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

  // Activates the saved power filters; ranges that no longer exist are ignored.
  async restoreFilters() {
    const { powerRanges } = await readFilters();
    for (const button of this.querySelectorAll(".power-filter")) {
      button.setAttribute("aria-pressed", String(powerRanges.includes(button.dataset.powerRange)));
    }
    this.updateClearFiltersButtons();
  }

  async loadEvChargers() {
    const bounds = this.map?.getBounds()?.toJSON();
    if (!bounds) {
      return;
    }
    const searchId = ++this.searchId;
    const zoom = this.map.getZoom();

    if (zoom < this.minChargerZoom) {
      this.loaded = null;
      this.clearMarkers();
      this.hideChargerDetails();
      this.setStatus("Zoom in to see EV chargers");
      return;
    }

    const apiKey = this.dataset.openChargeMapKey;
    if (!apiKey) {
      this.setStatus(
        "Open Charge Map API key is missing. Set VITE_OPEN_CHARGE_MAP_API_KEY.",
        "error"
      );
      return;
    }

    this.setListedChargers([]);
    this.setStatus("Loading EV chargers...", "loading");
    try {
      const { chargers, truncated } = await fetchChargersInBounds({ bounds, zoom, apiKey });
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
        this.setStatus("Could not load EV chargers", "error");
      } else {
        // Areas visited in the last day load from the service worker's cache.
        this.setStatus("You're offline. Chargers will load when you're back online.");
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
    const matching = chargers.filter((charger) => matchesPower(charger, ranges));

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

  // Lists the chargers nearest first: to the user if they've been located,
  // otherwise to the center of the map.
  renderChargerList() {
    const origin = this.userLocation ?? this.map.getCenter().toJSON();
    this.sortedChargers = this.listedChargers
      .map((charger) => ({ charger, meters: distanceInMeters(origin, charger.location) }))
      .sort((a, b) => a.meters - b.meters);

    const list = this.chargerList;
    const count = this.sortedChargers.length;
    list.querySelector(".title").textContent = `${count} EV charger${count === 1 ? "" : "s"}`;
    list.querySelector(".sort-basis").textContent = this.userLocation
      ? "Nearest to your location first"
      : "Nearest to the center of the map first";

    const template = list.querySelector(".item-template");
    list.querySelector(".items").replaceChildren(
      ...this.sortedChargers.map(({ charger, meters }, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".entry").dataset.index = String(index);
        item.querySelector(".name").textContent = charger.name;
        item.querySelector(".distance").textContent = formatDistance(meters);
        item.querySelector(".meta").textContent = [
          charger.maxPowerKw ? `${charger.maxPowerKw} kW` : null,
          charger.address,
        ]
          .filter(Boolean)
          .join(" · ");
        return item;
      })
    );
    list.querySelector(".body").scrollTop = 0;
  }

  // The status pill morphs into the list: only one element at a time may
  // carry the shared view-transition-name, so it moves inside the update.
  openChargerList() {
    if (!this.chargerList || this.chargerList.open || !this.listedChargers?.length) {
      return;
    }
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
      title: charger.name,
      content: this.cloneTemplate(".charger-marker-template"),
      gmpClickable: true,
    });
    marker.addEventListener("gmp-click", () => {
      this.setActiveMarker(marker);
      this.displayChargerDetails(charger);
    });
    return marker;
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
      title: `${count} EV chargers`,
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
    this.activeChargerId = charger.id;
    panel.querySelector(".name").textContent = charger.name;
    panel.querySelector(".address .text").textContent = charger.address;
    this.fillList(panel.querySelector(".connectors"), charger.connectors.map(formatConnector));
    this.fillList(panel.querySelector(".details"), formatDetails(charger));
    panel.hidden = false;
  }

  hideChargerDetails() {
    if (this.detailsPanel) {
      this.detailsPanel.hidden = true;
    }
    this.activeChargerId = null;
    this.setActiveMarker(null);
  }
}

customElements.define("ev-google-map", GoogleMapElement);

export { GoogleMapElement };
