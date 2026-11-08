/**
 * App Configuration
 * Central configuration for the EV Maps application
 */

export const appConfig = {
  // Google Maps
  googleMaps: {
    apiKey: import.meta.env.GOOGLE_MAPS_API_KEY || '',
    clientId: import.meta.env.GOOGLE_CLIENT_ID || '',
    defaultCenter: { lat: 40.7128, lng: -74.0060 }, // New York
    defaultZoom: 12,
    showEvChargers: true
  },
  
  // EV Charger settings
  evChargers: {
    enabled: true,
    filters: {
      connectorTypes: ['CCS', 'CHADEMO', 'Type2', 'Tesla'],
      powerLevels: ['slow', 'fast', 'rapid'],
      availability: ['available', 'busy', 'unknown']
    }
  },
  
  // User settings
  user: {
    requireSignIn: false,
    defaultMap: null
  }
};

export default appConfig;
