export const appConfig = {
  googleMaps: {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
    defaultCenter: { lat: 40.7128, lng: -74.006 },
    defaultZoom: 12,
    locatedZoom: 14,
  },
  evChargers: {
    enabled: true,
    searchRadiusMeters: 5000,
  },
};

export default appConfig;
