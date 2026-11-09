import { loadGoogleIdentity, loadGoogleMaps } from "./loader.js";
import { fetchChargerDetails, searchEvChargers } from "./places.js";

const PHOTO_MAX_WIDTH = 400;
const LAST_LOCATION_KEY = "ev-maps:last-location";

function readLastLocation() {
  try {
    const { lat, lng } = JSON.parse(localStorage.getItem(LAST_LOCATION_KEY));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

function saveLastLocation(location) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
}

function formatConnector({ type, count, availableCount, maxChargeRateKw }) {
  const name = String(type ?? "Unknown")
    .replace(/^EV_CONNECTOR_TYPE_/, "")
    .replaceAll("_", " ");
  const availability = availableCount == null ? "" : `, ${availableCount} available`;
  const power = maxChargeRateKw ? ` · up to ${maxChargeRateKw} kW` : "";
  return `${name}: ${count}×${power}${availability}`;
}

function decodeJwtPayload(token) {
  const base64 = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class GoogleMapElement extends HTMLElement {
  map = null;
  maps = null;
  markers = [];
  searchId = 0;
  mapReady = new Promise((resolve) => {
    this.resolveMapReady = resolve;
  });

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
        this.setStatus("Failed to load Google Maps");
      });

    if (this.dataset.clientId) {
      loadGoogleIdentity()
        .then((accounts) => this.initializeGoogleSignIn(accounts))
        .catch((error) => console.error(error));
    }
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
    this.addEventListener("locate-start", () => this.setStatus("Locating..."));
    this.addEventListener("location-found", (event) => this.handleLocationFound(event));
    this.addEventListener("location-error", (event) =>
      this.setStatus(event.detail?.message || "Unable to determine your location")
    );
    this.addEventListener("toggle-filters", () => this.toggleFilters());

    this.querySelector(".search-area-button")?.addEventListener("click", () =>
      this.loadEvChargers()
    );
    this.querySelector(".charger-details__close")?.addEventListener("click", () =>
      this.hideChargerDetails()
    );
    this.filterPanel?.addEventListener("submit", (event) => event.preventDefault());
    this.filterPanel?.addEventListener("change", () => this.handleFilterChange());
  }

  setStatus(message) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
  }

  async initMap(maps) {
    const { Map } = await maps.importLibrary("maps");
    this.maps = maps;
    const lastLocation = readLastLocation();
    this.map = new Map(this.mapEl, {
      center: lastLocation ?? {
        lat: Number(this.dataset.centerLat) || 0,
        lng: Number(this.dataset.centerLng) || 0,
      },
      zoom: lastLocation ? this.locatedZoom : Number(this.dataset.zoom) || 12,
      mapId: this.dataset.mapId || "DEMO_MAP_ID",
      gestureHandling: "greedy",
      fullscreenControl: false,
      streetViewControl: false,
    });
    this.resolveMapReady();

    if (this.showEvChargers) {
      await this.loadEvChargers();
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
    this.setStatus("Searching for EV chargers...");

    try {
      const center = this.map.getCenter().toJSON();
      const chargers = await searchEvChargers(this.maps, center, this.searchRadius);
      if (searchId !== this.searchId) {
        return;
      }
      await this.displayEvChargers(chargers);
      this.setStatus(
        chargers.length ? `${chargers.length} EV chargers found` : "No EV chargers found nearby"
      );
    } catch (error) {
      console.error("Error loading EV chargers:", error);
      this.setStatus("Could not load EV chargers");
    }
  }

  clearMarkers() {
    for (const marker of this.markers) {
      marker.map = null;
    }
    this.markers = [];
  }

  async displayEvChargers(chargers) {
    const { AdvancedMarkerElement } = await this.maps.importLibrary("marker");
    this.clearMarkers();
    this.markers = chargers.map((charger) => {
      const marker = new AdvancedMarkerElement({
        map: this.map,
        position: charger.location,
        title: charger.displayName ?? "EV charger",
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => this.showChargerDetails(charger));
      return marker;
    });
  }

  async showChargerDetails(charger) {
    try {
      this.displayChargerDetails(await fetchChargerDetails(charger));
    } catch (error) {
      console.error("Error fetching charger details:", error);
      this.setStatus("Could not load charger details");
    }
  }

  fillList(list, items) {
    const template = this.querySelector(".charger-details__item-template");
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
    panel.querySelector(".charger-details__name").textContent = details.displayName ?? "";
    panel.querySelector(".charger-details__address").textContent = details.formattedAddress ?? "";
    this.fillList(
      panel.querySelector(".charger-details__connectors"),
      (details.evChargeOptions?.connectorAggregations ?? []).map(formatConnector)
    );
    this.fillList(
      panel.querySelector(".charger-details__hours"),
      details.regularOpeningHours?.weekdayDescriptions ?? []
    );

    const photoEl = panel.querySelector(".charger-details__photo");
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
  }

  initializeGoogleSignIn(accounts) {
    const container = this.querySelector(".google-signin-button");
    if (!accounts?.id || !container) {
      return;
    }
    accounts.id.initialize({
      client_id: this.dataset.clientId,
      callback: (response) => this.handleGoogleSignIn(response),
      auto_select: false,
      cancel_on_tap_outside: false,
    });
    accounts.id.renderButton(container, { theme: "outline", size: "medium", type: "standard" });
  }

  handleGoogleSignIn({ credential }) {
    try {
      const { name, email } = decodeJwtPayload(credential);
      this.setStatus(`Signed in as ${name || email}`);
      this.querySelector(".google-signin-button").hidden = true;
      this.dispatchEvent(
        new CustomEvent("google-sign-in", { detail: { name, email, credential }, bubbles: true })
      );
    } catch (error) {
      console.error("Invalid Google Sign-In response:", error);
    }
  }
}

customElements.define("ev-google-map", GoogleMapElement);
