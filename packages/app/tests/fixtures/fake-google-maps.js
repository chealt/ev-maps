(() => {
  const callbackName = new URL(document.currentScript.src).searchParams.get("callback");
  const TILE_SIZE = 256;

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
      this.listeners = [];
      window.__fakeMap = this;
      this.emitIdle();
    }
    // Like Google Maps, "idle" fires after the map renders or stops moving.
    emitIdle() {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        for (const { event, handler } of this.listeners) {
          if (event === "idle") {
            handler();
          }
        }
      });
    }
    addListener(event, handler) {
      const listener = { event, handler };
      this.listeners.push(listener);
      return { remove: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
    }
    getCenter() {
      return new LatLng(this.center);
    }
    setCenter(center) {
      this.center = center;
      this.emitIdle();
    }
    setZoom(zoom) {
      this.zoom = zoom;
      this.emitIdle();
    }
    getZoom() {
      return this.zoom;
    }
    // An approximate Web Mercator viewport around the center.
    getBounds() {
      const degreesPerPixel = 360 / (TILE_SIZE * 2 ** this.zoom);
      const halfWidth = (this.element.clientWidth / 2) * degreesPerPixel;
      const halfHeight = (this.element.clientHeight / 2) * degreesPerPixel;
      const bounds = {
        north: Math.min(this.center.lat + halfHeight, 85),
        south: Math.max(this.center.lat - halfHeight, -85),
        east: Math.min(this.center.lng + halfWidth, 180),
        west: Math.max(this.center.lng - halfWidth, -180),
      };
      return { toJSON: () => bounds };
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

  const libraries = { maps: { Map }, marker: { AdvancedMarkerElement } };

  window.google = {
    maps: { importLibrary: async (name) => libraries[name] },
  };
  window[callbackName]();
})();
