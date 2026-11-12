import { deleteExpiredTiles, fetchChargersInBounds } from "./chargers.js";
import { loadGoogleMaps } from "./loader.js";

const LAST_LOCATION_KEY = "ev-maps:last-location";
// Google Maps color schemes for the themes set by ThemePicker on <html>.
const COLOR_SCHEMES = { system: "FOLLOW_SYSTEM", light: "LIGHT", dark: "DARK" };

const currentColorScheme = () =>
  COLOR_SCHEMES[document.documentElement.dataset.theme] ?? COLOR_SCHEMES.system;

const readLastLocation = () => {
  try {
    const { lat, lng } = JSON.parse(localStorage.getItem(LAST_LOCATION_KEY));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
};

const saveLastLocation = (location) => {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
};

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

const chargerCountMessage = (count, truncated) => {
  if (!count) {
    return "No EV chargers in this area";
  }
  if (truncated) {
    return `Showing ${count} EV chargers, zoom in to see all`;
  }
  return `${count} EV chargers found`;
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
    this.statusEl = this.querySelector(".map-status");
    this.mapEl = this.querySelector(".google-map");
    this.filterPanel = this.querySelector(".filter-panel");
    this.detailsPanel = this.querySelector(".charger-details");

    this.setupEventListeners();

    const apiKey = this.dataset.apiKey;
    if (!apiKey) {
      return;
    }

    deleteExpiredTiles().catch((error) => console.error(error));

    loadGoogleMaps(apiKey)
      .then((maps) => this.initMap(maps))
      .catch((error) => {
        console.error(error);
        this.setStatus("Failed to load Google Maps", "error");
      });
  }

  disconnectedCallback() {
    document.removeEventListener("theme-change", this.handleThemeChange);
  }

  get showEvChargers() {
    return this.dataset.showEvChargers === "true";
  }

  get locatedZoom() {
    return Number(this.dataset.locatedZoom) || 14;
  }

  get minChargerZoom() {
    return Number(this.dataset.minChargerZoom) || 8;
  }

  setupEventListeners() {
    this.addEventListener("locate-start", () => this.setStatus("Locating...", "loading"));
    this.addEventListener("location-found", (event) => this.handleLocationFound(event));
    this.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || "Unable to determine your location", "error")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());
    document.addEventListener("theme-change", this.handleThemeChange);

    this.detailsPanel
      ?.querySelector(".close")
      ?.addEventListener("click", () => this.hideChargerDetails());
    this.filterPanel?.addEventListener("submit", (event) => event.preventDefault());
    this.filterPanel?.addEventListener("change", () => this.handleFilterChange());
  }

  setStatus(message, state = "idle") {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusEl.dataset.state = state;
    }
  }

  async initMap(maps) {
    const { Map } = await maps.importLibrary("maps");
    this.maps = maps;
    this.MapClass = Map;
    const lastLocation = readLastLocation();
    this.createMap({
      center: lastLocation ?? {
        lat: Number(this.dataset.centerLat) || 0,
        lng: Number(this.dataset.centerLng) || 0,
      },
      zoom: lastLocation ? this.locatedZoom : Number(this.dataset.zoom) || 12,
    });
    this.resolveMapReady();
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
    // "idle" fires once the map has finished moving or zooming.
    this.map.addListener("idle", () => this.loadEvChargers());
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
    this.setStatus(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    saveLastLocation({ lat, lng });

    await this.mapReady;
    this.map.setCenter({ lat, lng });
    this.map.setZoom(this.locatedZoom);
  }

  toggleFilters() {
    if (!this.filterPanel) {
      return;
    }
    this.filterPanel.hidden = !this.filterPanel.hidden;
    this.querySelector(".filter-button")?.setAttribute(
      "aria-expanded",
      String(!this.filterPanel.hidden)
    );
  }

  handleFilterChange() {
    const form = new FormData(this.filterPanel);
    this.toggleEvChargers(form.has("showEvChargers"));
  }

  toggleEvChargers(show) {
    this.dataset.showEvChargers = String(show);
    if (show) {
      this.loadEvChargers();
    } else {
      this.clearMarkers();
      this.hideChargerDetails();
    }
  }

  async loadEvChargers() {
    const bounds = this.map?.getBounds()?.toJSON();
    if (!bounds || !this.showEvChargers) {
      return;
    }
    const searchId = ++this.searchId;
    const zoom = this.map.getZoom();

    if (zoom < this.minChargerZoom) {
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

    this.setStatus("Loading EV chargers...", "loading");
    try {
      const { chargers, truncated } = await fetchChargersInBounds({ bounds, zoom, apiKey });
      if (searchId !== this.searchId) {
        return;
      }
      await this.displayEvChargers(chargers);
      this.setStatus(
        chargerCountMessage(chargers.length, truncated),
        chargers.length ? "success" : "idle"
      );
    } catch (error) {
      console.error("Error loading EV chargers:", error);
      if (searchId === this.searchId) {
        this.setStatus("Could not load EV chargers", "error");
      }
    }
  }

  clearMarkers() {
    for (const marker of this.markersById.values()) {
      marker.map = null;
    }
    this.markersById.clear();
    this.activeMarker = null;
  }

  createMarkerContent() {
    const template = this.querySelector(".charger-marker-template");
    return template?.content.firstElementChild.cloneNode(true);
  }

  setActiveMarker(marker) {
    this.activeMarker?.content?.classList.remove("active");
    this.activeMarker = marker;
    marker?.content?.classList.add("active");
  }

  // Keeps markers that are still in view, so they don't flicker on every move.
  async displayEvChargers(chargers) {
    const { AdvancedMarkerElement } = await this.maps.importLibrary("marker");
    const ids = new Set(chargers.map((charger) => charger.id));

    for (const [id, marker] of this.markersById) {
      if (!ids.has(id)) {
        marker.map = null;
        this.markersById.delete(id);
      }
    }

    for (const charger of chargers) {
      if (this.markersById.has(charger.id)) {
        continue;
      }
      const marker = new AdvancedMarkerElement({
        map: this.map,
        position: charger.location,
        title: charger.name,
        content: this.createMarkerContent(),
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => {
        this.setActiveMarker(marker);
        this.displayChargerDetails(charger);
      });
      this.markersById.set(charger.id, marker);
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
    this.setActiveMarker(null);
  }
}

customElements.define("ev-google-map", GoogleMapElement);

export { GoogleMapElement };
