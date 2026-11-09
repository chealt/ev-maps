import { GoogleMapsClient } from '@googlemaps/google-maps-services-js';

const client = new GoogleMapsClient({});

// Fetch EV chargers within a given radius
async function fetchEvChargers(lat, lng, radius = 5000) {
  try {
    const response = await client.placesNearby({
      params: {
        location: `${lat},${lng}`,
        radius: radius,
        type: 'electric_vehicle_charging_station',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    return response.data.results;
  } catch (error) {
    console.error('Error fetching EV chargers:', error);
    throw error;
  }
}

// Fetch details for a specific EV charger
async function fetchEvChargerDetails(placeId) {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    return response.data.result;
  } catch (error) {
    console.error('Error fetching EV charger details:', error);
    throw error;
  }
}

export { fetchEvChargers, fetchEvChargerDetails };
