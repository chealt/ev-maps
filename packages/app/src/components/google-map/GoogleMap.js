import { loadGoogleMaps } from "./loader.js";
import { fetchChargerDetails, searchEvChargers } from "./places.js";

const PHOTO_MAX_WIDTH = 400;
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

const formatConnector = ({ type, count, availableCount, maxChargeRateKw }) => {
  const name = String(type ?? "Unknown")
    .replace(/^EV_CONNECTOR_TYPE_/, "")
    .replaceAll("_", " ");
  const availability = availableCount == null ? "" : `, ${availableCount} available`;
  const power = maxChargeRateKw ? ` · up to ${maxChargeRateKw} kW` : "";
  return `${name}: ${count}×${power}${availability}`;
};

class GoogleMapElement extends HTMLElement {
  map = null;
  maps = null;
  markers = [];
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

  get searchRadius() {
    return Number(this.dataset.searchRadius) || 5000;
  }

  setupEventListeners() {
    this.addEventListener("locate-start", () => this.setStatus("Locating...", "loading"));
    this.addEventListener("location-found", (event) => this.handleLocationFound(event));
    this.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || "Unable to determine your location", "error")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());
    document.addEventListener("theme-change", this.handleThemeChange);

    this.querySelector(".search-area-button")?.addEventListener("click", () =>
      this.loadEvChargers()
    );
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

    if (this.showEvChargers) {
      await this.loadEvChargers();
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
    for (const marker of this.markers) {
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
    this.loadEvChargers();
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
    this.dataset.searchRadius = form.get("searchRadius");
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
    if (!this.map || !this.showEvChargers) {
      return;
    }
    const searchId = ++this.searchId;
    this.setStatus("Searching for EV chargers...", "loading");

    try {
      const center = this.map.getCenter().toJSON();
      const chargers = await searchEvChargers(this.maps, center, this.searchRadius);
      if (searchId !== this.searchId) {
        return;
      }
      await this.displayEvChargers(chargers);
      this.setStatus(
        chargers.length ? `${chargers.length} EV chargers found` : "No EV chargers found nearby",
        chargers.length ? "success" : "idle"
      );
    } catch (error) {
      console.error("Error loading EV chargers:", error);
      this.setStatus("Could not load EV chargers", "error");
    }
  }

  clearMarkers() {
    for (const marker of this.markers) {
      marker.map = null;
    }
    this.markers = [];
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

  async displayEvChargers(chargers) {
    const { AdvancedMarkerElement } = await this.maps.importLibrary("marker");
    this.clearMarkers();
    this.markers = chargers.map((charger) => {
      const marker = new AdvancedMarkerElement({
        map: this.map,
        position: charger.location,
        title: charger.displayName ?? "EV charger",
        content: this.createMarkerContent(),
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => {
        this.setActiveMarker(marker);
        this.showChargerDetails(charger);
      });
      return marker;
    });
  }

  async showChargerDetails(charger) {
    try {
      this.displayChargerDetails(await fetchChargerDetails(charger));
    } catch (error) {
      console.error("Error fetching charger details:", error);
      this.setStatus("Could not load charger details", "error");
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

  displayChargerDetails(details) {
    const panel = this.detailsPanel;
    if (!panel) {
      return;
    }
    panel.querySelector(".name").textContent = details.displayName ?? "";
    panel.querySelector(".address .text").textContent = details.formattedAddress ?? "";
    this.fillList(
      panel.querySelector(".connectors"),
      (details.evChargeOptions?.connectorAggregations ?? []).map(formatConnector)
    );
    this.fillList(
      panel.querySelector(".hours"),
      details.regularOpeningHours?.weekdayDescriptions ?? []
    );

    const photoEl = panel.querySelector(".photo");
    const photo = details.photos?.[0];
    photoEl.hidden = !photo;
    photoEl.src = photo ? photo.getURI({ maxWidth: PHOTO_MAX_WIDTH }) : "";
    photoEl.alt = photo ? (details.displayName ?? "") : "";

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
