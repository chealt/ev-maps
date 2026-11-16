const appConfig = {
  googleMaps: {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
    defaultCenter: { lat: 40.7128, lng: -74.006 },
    defaultZoom: 12,
    locatedZoom: 14,
    autoLocate: true,
  },
  evChargers: {
    // Below this map zoom the visible area is too large to load chargers for.
    minZoom: 9,
  },
};

export { appConfig };
