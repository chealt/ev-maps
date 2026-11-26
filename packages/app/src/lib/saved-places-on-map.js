// Whether the signed-in user's saved places (route-history.js) show on the
// map as pins with their icons: by default they do, unless turned off in the
// account menu. Kept like the other account-menu preferences
// (account-preference.js), in the account's `savedPlacesOnMap` section.

import { createAccountPreference } from "./account-preference.js";

const preference = createAccountPreference({
  storageKey: "ev-maps:saved-places-on-map",
  section: "savedPlacesOnMap",
  field: "shown",
  values: [true, false],
});

const savedPlacesOnMap = () => preference.get() ?? true;
const setSavedPlacesOnMap = (shown) => preference.set(shown);
// Calls `listener()` when the choice changes.
const onSavedPlacesOnMapChange = preference.onChange;

export { onSavedPlacesOnMapChange, savedPlacesOnMap, setSavedPlacesOnMap };
