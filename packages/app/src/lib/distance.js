import { distanceUnit } from "./distance-unit.js";
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

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

// E.g. "350 m", "4.2 km", "35 km", or in miles "500 ft", "2.6 mi", "22 mi",
// in the page's language and the user's unit (./distance-unit.js). Short
// distances in miles are in feet, as navigation apps show them.
const formatDistance = (meters, unit = distanceUnit()) => {
  if (unit === "imperial") {
    const miles = meters / METERS_PER_MILE;
    return miles < 0.1
      ? formatNumber(Math.round((meters * FEET_PER_METER) / 10) * 10, {
          style: "unit",
          unit: "foot",
        })
      : formatNumber(miles, {
          style: "unit",
          unit: "mile",
          maximumFractionDigits: miles < 10 ? 1 : 0,
        });
  }
  return meters < 1000
    ? formatNumber(Math.round(meters / 10) * 10, { style: "unit", unit: "meter" })
    : formatNumber(meters / 1000, {
        style: "unit",
        unit: "kilometer",
        maximumFractionDigits: meters < 10000 ? 1 : 0,
      });
};

export { distanceInMeters, formatDistance };
