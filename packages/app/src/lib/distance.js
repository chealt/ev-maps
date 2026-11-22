import { formatNumber } from "./messages.js";

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle (haversine) distance between two { lat, lng } points.
const distanceInMeters = (from, to) => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

// E.g. "350 m", "4.2 km", "35 km", in the page's language.
const formatDistance = (meters) =>
  meters < 1000
    ? formatNumber(Math.round(meters / 10) * 10, { style: "unit", unit: "meter" })
    : formatNumber(meters / 1000, {
        style: "unit",
        unit: "kilometer",
        maximumFractionDigits: meters < 10000 ? 1 : 0,
      });

export { distanceInMeters, formatDistance };
