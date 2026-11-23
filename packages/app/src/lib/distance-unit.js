// The unit distances are shown in: kilometres or miles. By default the one
// the user's locale drives in (the browser's region: miles in the US, the
// UK, Liberia and Myanmar), unless they chose one in the account menu.

import { createAccountPreference } from "./account-preference.js";

const DISTANCE_UNITS = ["metric", "imperial"];
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

// The browser's region, e.g. "en-GB" → GB; a bare "en" is likely the US.
const localeUnit = (language = navigator.language) => {
  try {
    const { region } = new Intl.Locale(language).maximize();
    return MILE_REGIONS.has(region) ? "imperial" : "metric";
  } catch {
    return "metric";
  }
};

const preference = createAccountPreference({
  storageKey: "ev-maps:distance-unit",
  section: "distanceUnit",
  field: "unit",
  values: DISTANCE_UNITS,
});

// The unit to show distances in: the chosen one, else the locale's.
const distanceUnit = () => preference.get() ?? localeUnit();
// The choice: "metric", "imperial", or null to follow the locale.
const chosenDistanceUnit = preference.get;
const setDistanceUnit = preference.set;
// Calls `listener()` when the choice changes.
const onDistanceUnitChange = preference.onChange;

export {
  DISTANCE_UNITS,
  chosenDistanceUnit,
  distanceUnit,
  localeUnit,
  onDistanceUnitChange,
  setDistanceUnit,
};
