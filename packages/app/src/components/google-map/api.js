/**
 * API functions for fetching EV charger data
 * Uses the Google Maps Places API to find EV charging stations
 */

/**
 * Fetch EV chargers within a given radius
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} apiKey - Google Maps API key
 * @param {number} [radius=5000] - Search radius in meters
 * @returns {Promise<Array>} Array of EV charger places
 */
async function fetchEvChargers(lat, lng, apiKey, radius = 5000) {
  try {
    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
    );
    url.searchParams.append('location', `${lat},${lng}`);
    url.searchParams.append('radius', radius);
    url.searchParams.append('type', 'electric_vehicle_charging_station');
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching EV chargers:', error);
    throw error;
  }
}

/**
 * Fetch details for a specific EV charger
 * @param {string} placeId - Google Places place ID
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<Object>} EV charger details
 */
async function fetchEvChargerDetails(placeId, apiKey) {
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', placeId);
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.result || {};
  } catch (error) {
    console.error('Error fetching EV charger details:', error);
    throw error;
  }
}

export { fetchEvChargers, fetchEvChargerDetails };
