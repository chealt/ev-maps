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
      // A right-click (and, on touch, a long press) is the map's
      // "contextmenu": the place under the pointer, and the DOM event.
      element.addEventListener("contextmenu", (domEvent) => {
        domEvent.preventDefault();
        const rect = element.getBoundingClientRect();
        const latLng = new LatLng(
          this.placeAt(domEvent.clientX - rect.left, domEvent.clientY - rect.top)
        );
        this.emit("contextmenu", { latLng, domEvent });
      });
      this.emitIdle();
    }
    emit(type, event) {
      for (const { event: name, handler } of this.listeners) {
        if (name === type) {
          handler(event);
        }
      }
    }
    // The place at a pixel of the map's element: pixelOf's inverse.
    placeAt(x, y) {
      const degreesPerPixel = 360 / (TILE_SIZE * 2 ** this.zoom);
      return {
        lat: this.center.lat - (y - this.element.clientHeight / 2) * degreesPerPixel,
        lng: this.center.lng + (x - this.element.clientWidth / 2) * degreesPerPixel,
      };
    }
    // Like Google Maps, "idle" fires after the map renders or stops moving.
    emitIdle() {
      this.drawLines();
      this.placeMarkers();
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
    addMarker(marker) {
      (this.markers ??= new Set()).add(marker);
      this.placeMarkers();
    }
    removeMarker(marker) {
      this.markers?.delete(marker);
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
    // Centers the bounds at the largest zoom that fits them inside the
    // padding (a number for every side, or one per side), as Google's does.
    fitBounds({ north, south, east, west }, padding = 0) {
      this.fittedBounds = { north, south, east, west };
      const sides =
        typeof padding === "number"
          ? { top: padding, right: padding, bottom: padding, left: padding }
          : { top: 0, right: 0, bottom: 0, left: 0, ...padding };
      this.fittedPadding = sides;
      this.center = { lat: (north + south) / 2, lng: (east + west) / 2 };
      const fits = (zoom) => {
        const degreesPerPixel = 360 / (TILE_SIZE * 2 ** zoom);
        return (
          (east - west) / degreesPerPixel <= this.element.clientWidth - sides.left - sides.right &&
          (north - south) / degreesPerPixel <= this.element.clientHeight - sides.top - sides.bottom
        );
      };
      let zoom = 0;
      while (zoom < 21 && fits(zoom + 1)) {
        zoom++;
      }
      this.zoom = zoom;
      this.emitIdle();
    }
    // Puts each marker's element where its position is, once the map is
    // created and after each move, as Google Maps does.
    placeMarkers() {
      for (const marker of this.markers ?? []) {
        const { x, y } = this.pixelOf(marker.position ?? this.center);
        marker.element.style.position = "absolute";
        marker.element.style.left = `${x}px`;
        marker.element.style.top = `${y}px`;
      }
    }
    // A point's place on the map's element, as getBounds() sees the view.
    pixelOf({ lat, lng }) {
      const degreesPerPixel = 360 / (TILE_SIZE * 2 ** this.zoom);
      return {
        x: (lng - this.center.lng) / degreesPerPixel + this.element.clientWidth / 2,
        y: (this.center.lat - lat) / degreesPerPixel + this.element.clientHeight / 2,
      };
    }
    // Draws its polylines (e.g. a route) where they are, in an SVG over the
    // map, so screenshots show them; clicks and assistive tech pass through.
    drawLines() {
      const lines = [...(this.lines ?? [])].sort(
        (a, b) => (a.options.zIndex ?? 0) - (b.options.zIndex ?? 0)
      );
      if (!lines.length) {
        this.svg?.remove();
        this.svg = null;
        return;
      }
      if (!this.svg) {
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("aria-hidden", "true");
        this.svg.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      }
      if (!this.svg.isConnected) {
        this.element.prepend(this.svg);
      }
      this.svg.replaceChildren(
        ...lines.map(({ options }) => {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
          const points = (options.path ?? []).map((point) => this.pixelOf(point));
          line.setAttribute("points", points.map(({ x, y }) => `${x},${y}`).join(" "));
          line.setAttribute("fill", "none");
          line.setAttribute("stroke", options.strokeColor ?? "black");
          line.setAttribute("stroke-width", options.strokeWeight ?? 3);
          line.setAttribute("stroke-opacity", options.strokeOpacity ?? 1);
          line.setAttribute("stroke-linecap", "round");
          line.setAttribute("stroke-linejoin", "round");
          return line;
        })
      );
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
    constructor({ map, position, title, content }) {
      this.element = document.createElement("button");
      this.label = document.createElement("span");
      this.element.append(this.label);
      // The pin, e.g. to check its classes; the title names the button.
      this.content = content;
      if (content) {
        this.element.append(content);
      }
      this.position = position;
      this.title = title;
      this.map = map;
    }
    set position(position) {
      this._position = position;
      this.map?.placeMarkers();
    }
    get position() {
      return this._position;
    }
    set title(title) {
      this._title = title;
      this.label.textContent = title;
    }
    get title() {
      return this._title;
    }
    set map(map) {
      if (this._map) {
        this._map.removeMarker(this);
      }
      this._map = map;
      if (map) {
        map.addMarker(this);
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

  // A place by its ID, as the app rebuilds a saved route's places; its
  // location once fetched, as Google's.
  class Place {
    constructor({ id }) {
      this.id = id;
    }
    async fetchFields() {
      const known = PLACES.find((place) => place.id === this.id)?.location;
      this.location = known && { ...known, toJSON: () => known };
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
              toPlace: () => ({
                id: place.id,
                location: { ...place.location, toJSON: () => place.location },
                fetchFields: async () => {},
              }),
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

  // Drives along straight lines through any intermediates, 20 steps per leg;
  // the ocean has no route.
  const Route = {
    async computeRoutes(request) {
      window.__routeRequests.push(request);
      if (request.destination.id === "nowhere" || request.origin.id === "nowhere") {
        return { routes: [] };
      }
      const waypoints = [
        pointOf(request.origin),
        ...(request.intermediates ?? []).map(pointOf),
        pointOf(request.destination),
      ];
      const path = [waypoints[0]];
      for (let leg = 0; leg < waypoints.length - 1; leg++) {
        const from = waypoints[leg];
        const to = waypoints[leg + 1];
        for (let index = 1; index <= 20; index++) {
          path.push({
            lat: from.lat + ((to.lat - from.lat) * index) / 20,
            lng: from.lng + ((to.lng - from.lng) * index) / 20,
          });
        }
      }
      // Each leg's distanceMeters (equirectangular, close enough here), as
      // the real Routes API's legs carry them.
      const legs = waypoints.slice(1).map((to, index) => {
        const from = waypoints[index];
        const dLat = (to.lat - from.lat) * 111320;
        const dLng = (to.lng - from.lng) * 111320 * Math.cos((from.lat * Math.PI) / 180);
        return { distanceMeters: Math.hypot(dLat, dLng) };
      });
      return { routes: [{ path, legs }] };
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
      if (this.map && this.map !== map) {
        this.map.lines.delete(this);
        this.map.drawLines();
      }
      this.map = map;
      if (map) {
        shownLines.add(this);
        map.lines ??= new Set();
        map.lines.add(this);
        map.drawLines();
      } else {
        shownLines.delete(this);
      }
      showLines();
    }
    setOptions(options) {
      this.options = { ...this.options, ...options };
      this.map?.drawLines();
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
