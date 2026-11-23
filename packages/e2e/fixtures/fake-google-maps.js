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
    // Moves the view by (x, y) pixels.
    panBy(x, y) {
      const degreesPerPixel = 360 / (TILE_SIZE * 2 ** this.zoom);
      this.center = {
        lat: this.center.lat - y * degreesPerPixel,
        lng: this.center.lng + x * degreesPerPixel,
      };
      this.emitIdle();
    }
    getZoom() {
      return this.zoom;
    }
    // Centers the bounds at the largest zoom that fits them.
    fitBounds({ north, south, east, west }) {
      this.fittedBounds = { north, south, east, west };
      this.center = { lat: (north + south) / 2, lng: (east + west) / 2 };
      const fits = (zoom) => {
        const degreesPerPixel = 360 / (TILE_SIZE * 2 ** zoom);
        return (
          (east - west) / degreesPerPixel <= this.element.clientWidth &&
          (north - south) / degreesPerPixel <= this.element.clientHeight
        );
      };
      let zoom = 0;
      while (zoom < 21 && fits(zoom + 1)) {
        zoom++;
      }
      this.zoom = zoom;
      this.emitIdle();
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
    constructor({ map, title, content }) {
      this.element = document.createElement("button");
      this.label = document.createElement("span");
      this.element.append(this.label);
      // The pin, e.g. to check its classes; the title names the button.
      this.content = content;
      if (content) {
        this.element.append(content);
      }
      this.title = title;
      this.map = map;
    }
    set title(title) {
      this._title = title;
      this.label.textContent = title;
    }
    get title() {
      return this._title;
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

  // Places the fake place search knows, and records of what was asked.
  const PLACES = [
    {
      id: "budapest",
      main: "Budapest",
      secondary: "Hungary",
      location: { lat: 47.4979, lng: 19.0402 },
    },
    {
      id: "vienna",
      main: "Vienna",
      secondary: "Austria",
      location: { lat: 48.2082, lng: 16.3738 },
    },
    { id: "nowhere", main: "Nowhere Island", secondary: "Ocean", location: { lat: 0, lng: -30 } },
  ];
  window.__placeRequests = [];
  window.__routeRequests = [];

  class AutocompleteSessionToken {}

  // A place by its ID, as the app rebuilds a saved route's places.
  class Place {
    constructor({ id }) {
      this.id = id;
    }
  }

  const AutocompleteSuggestion = {
    async fetchAutocompleteSuggestions(request) {
      window.__placeRequests.push(request);
      const text = request.input.toLowerCase();
      return {
        suggestions: PLACES.filter((place) => place.main.toLowerCase().startsWith(text)).map(
          (place) => ({
            placePrediction: {
              text: { toString: () => `${place.main}, ${place.secondary}` },
              mainText: { toString: () => place.main },
              secondaryText: { toString: () => place.secondary },
              toPlace: () => ({ id: place.id, location: place.location }),
            },
          })
        ),
      };
    },
  };

  // A place or a location, as the app passes them, as { lat, lng }; a place
  // known only by its ID is looked up, as Google would.
  const pointOf = (endpoint) =>
    endpoint.location ?? PLACES.find((place) => place.id === endpoint.id)?.location ?? endpoint;

  // Drives along a straight line in 20 steps; the ocean has no route.
  const Route = {
    async computeRoutes(request) {
      window.__routeRequests.push(request);
      if (request.destination.id === "nowhere" || request.origin.id === "nowhere") {
        return { routes: [] };
      }
      const from = pointOf(request.origin);
      const to = pointOf(request.destination);
      const path = Array.from({ length: 21 }, (_, index) => ({
        lat: from.lat + ((to.lat - from.lat) * index) / 20,
        lng: from.lng + ((to.lng - from.lng) * index) / 20,
      }));
      return { routes: [{ path }] };
    },
  };

  // The route line on the map, readable by tests as window.__fakeRouteLine.
  // The polylines on the map: __fakeRouteLines has the options of each (the
  // route's casing and line), __fakeRouteLine the topmost's, or null.
  const shownLines = new Set();
  const showLines = () => {
    const lines = [...shownLines].map((line) => line.options);
    lines.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    window.__fakeRouteLines = lines;
    window.__fakeRouteLine = lines.at(-1) ?? null;
  };
  class Polyline {
    constructor(options) {
      this.options = options;
      this.setMap(options.map);
    }
    setMap(map) {
      this.map = map;
      if (map) {
        shownLines.add(this);
      } else {
        shownLines.delete(this);
      }
      showLines();
    }
    setOptions(options) {
      this.options = { ...this.options, ...options };
      showLines();
    }
  }

  const libraries = {
    maps: { Map, Polyline },
    marker: { AdvancedMarkerElement },
    places: { AutocompleteSuggestion, AutocompleteSessionToken, Place },
    routes: { Route },
  };

  window.google = {
    maps: { importLibrary: async (name) => libraries[name] },
  };
  window[callbackName]();
})();
