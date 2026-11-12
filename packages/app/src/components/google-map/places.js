const CHARGER_TYPE = "electric_vehicle_charging_station";
const MAX_RESULTS = 20;

const searchEvChargers = async (maps, center, radius) => {
  const { Place } = await maps.importLibrary("places");
  const { places } = await Place.searchNearby({
    fields: ["id", "displayName", "location"],
    includedTypes: [CHARGER_TYPE],
    locationRestriction: { center, radius },
    maxResultCount: MAX_RESULTS,
  });
  return places;
};

const fetchChargerDetails = async (place) => {
  await place.fetchFields({
    fields: ["displayName", "formattedAddress", "regularOpeningHours", "photos", "evChargeOptions"],
  });
  return place;
};

export { searchEvChargers, fetchChargerDetails };
