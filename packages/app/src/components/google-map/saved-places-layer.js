// The signed-in user's saved places (route-history.js) on the map, each a
// pin with its icon (Home, Work, …) and its name as the pin's title; a
// click (or Enter) on one selects it (`onSelect`). A place
// saved before saved places kept their location is looked up by its Google
// place ID (once per page).

const lookedUp = new Map();

// A saved place's location: its own, or Google's for its place ID.
const locate = async (maps, saved) => {
  if (saved.location) {
    return saved.location;
  }
  if (!saved.placeId) {
    return null;
  }
  if (!lookedUp.has(saved.placeId)) {
    lookedUp.set(
      saved.placeId,
      maps
        .importLibrary("places")
        .then(async ({ Place }) => {
          const place = new Place({ id: saved.placeId });
          await place.fetchFields({ fields: ["location"] });
          return place.location?.toJSON?.() ?? place.location ?? null;
        })
        .catch(() => null)
    );
  }
  return lookedUp.get(saved.placeId);
};

class SavedPlacesLayer {
  // `pin(icon)`: a new pin's content with that icon; `onSelect(saved,
  // location, pinElement)`: a pin was clicked.
  constructor({ maps, pin, onSelect = () => {} }) {
    this.maps = maps;
    this.pin = pin;
    this.onSelect = onSelect;
    this.markers = [];
    this.map = null;
    this.shown = 0;
  }

  // Shows `places` on `map` (none: hides them).
  async show(map, places) {
    const shown = ++this.shown;
    const { AdvancedMarkerElement } = await this.maps.importLibrary("marker");
    const located = await Promise.all(
      places.map(async (saved) => ({ saved, location: await locate(this.maps, saved) }))
    );
    // A newer call (e.g. the place was removed meanwhile) wins.
    if (shown !== this.shown) {
      return;
    }
    this.clear();
    this.map = map;
    this.markers = located
      .filter(({ location }) => location)
      .map(({ saved, location }) => {
        const content = this.pin(saved.icon);
        const marker = new AdvancedMarkerElement({
          map,
          position: location,
          title: saved.name,
          content,
          gmpClickable: true,
          // Below the chargers' pins.
          zIndex: -1,
        });
        marker.addEventListener("gmp-click", () => this.onSelect(saved, location, content));
        return marker;
      });
  }

  // The map was replaced (a theme change): the pins move to the new one.
  moveTo(map) {
    this.map = map;
    for (const marker of this.markers) {
      marker.map = map;
    }
  }

  clear() {
    for (const marker of this.markers) {
      marker.map = null;
    }
    this.markers = [];
  }
}

export { SavedPlacesLayer };
