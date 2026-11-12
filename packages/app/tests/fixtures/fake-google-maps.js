(() => {
  const callbackName = new URL(document.currentScript.src).searchParams.get("callback");

  const CHARGERS = [
    {
      id: "charger-1",
      displayName: "Downtown Supercharger",
      location: { lat: 40.71, lng: -74.0 },
      details: {
        formattedAddress: "1 Main St, New York",
        regularOpeningHours: { weekdayDescriptions: ["Monday: Open 24 hours"] },
        evChargeOptions: {
          connectorAggregations: [
            {
              type: "EV_CONNECTOR_TYPE_CCS_COMBO_2",
              count: 4,
              availableCount: 2,
              maxChargeRateKw: 150,
            },
          ],
        },
        photos: [],
      },
    },
    {
      id: "charger-2",
      displayName: '<img src="x" onerror="window.__xss = true">',
      location: { lat: 40.72, lng: -74.01 },
      details: { formattedAddress: "2 Side St, New York" },
    },
  ];

  class LatLng {
    constructor({ lat, lng }) {
      this.lat = lat;
      this.lng = lng;
    }
    toJSON() {
      return { lat: this.lat, lng: this.lng };
    }
  }

  class Map {
    constructor(element, options) {
      this.element = element;
      this.options = options;
      this.center = options.center;
      this.zoom = options.zoom;
      window.__fakeMap = this;
    }
    getCenter() {
      return new LatLng(this.center);
    }
    setCenter(center) {
      this.center = center;
    }
    setZoom(zoom) {
      this.zoom = zoom;
    }
  }

  class AdvancedMarkerElement {
    constructor({ map, title }) {
      this.element = document.createElement("button");
      this.element.textContent = title;
      this.map = map;
    }
    set map(map) {
      this._map = map;
      if (map) {
        map.element.append(this.element);
      } else {
        this.element.remove();
      }
    }
    get map() {
      return this._map;
    }
    addEventListener(type, listener) {
      if (type === "gmp-click") {
        this.element.addEventListener("click", listener);
      }
    }
  }

  class Place {
    constructor({ details, ...data }) {
      Object.assign(this, data);
      this.details = details;
    }
    static async searchNearby(request) {
      window.__searchRequests = [...(window.__searchRequests ?? []), request];
      return { places: CHARGERS.map((charger) => new Place(charger)) };
    }
    async fetchFields() {
      Object.assign(this, this.details);
    }
  }

  const libraries = { maps: { Map }, marker: { AdvancedMarkerElement }, places: { Place } };

  window.google = {
    maps: { importLibrary: async (name) => libraries[name] },
  };
  window[callbackName]();
})();
