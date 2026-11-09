const CHARGER_TYPE = "electric_vehicle_charging_station";
const MAX_RESULTS = 20;

export async function searchEvChargers(maps, center, radius) {
  const { Place } = await maps.importLibrary("places");
  const { places } = await Place.searchNearby({
    fields: ["id", "displayName", "location"],
    includedTypes: [CHARGER_TYPE],
    locationRestriction: { center, radius },
    maxResultCount: MAX_RESULTS,
  });
  return places;
}

export async function fetchChargerDetails(place) {
  await place.fetchFields({
    fields: ["displayName", "formattedAddress", "regularOpeningHours", "photos", "evChargeOptions"],
  });
  return place;
}
