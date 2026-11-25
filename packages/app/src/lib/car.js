// The user's car: the connector groups it charges with (the map's filter
// panel's groups, src/lib/connector-groups.js) and whether chargers are
// filtered by them automatically. Kept like the account preferences
// (src/lib/account-preference.js): in memory, on this device (localStorage),
// and, signed in, in the account (the settings' `car` section), where the
// newer copy wins. All keep { connectors, autoFilter, updatedAt }.

import { fetchAccountSettings, saveAccountSettings } from "./account-settings.js";
import { isSignedIn, onSessionChange } from "./session.js";

const STORAGE_KEY = "ev-maps:car";

const isCar = (value) =>
  Array.isArray(value?.connectors) &&
  value.connectors.every((connector) => typeof connector === "string") &&
  typeof value?.autoFilter === "boolean" &&
  Number.isFinite(value?.updatedAt);

const readLocal = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isCar(saved)) {
      return saved;
    }
  } catch {
    // Storage can be unavailable, or hold something else.
  }
  return { connectors: [], autoFilter: false, updatedAt: 0 };
};

let car = readLocal();
const listeners = new Set();

const saveLocal = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(car));
  } catch {
    // Storage can be unavailable; the choice lasts until the page is left.
  }
};

const adopt = (next) => {
  car = next;
  saveLocal();
  for (const listener of listeners) {
    listener(car);
  }
};

// Signed in: the account's car if it's newer, else this device's to the
// account.
const syncWithAccount = async () => {
  const saved = (await fetchAccountSettings())?.car;
  if (isCar(saved) && saved.updatedAt > car.updatedAt) {
    adopt(saved);
  } else if (car.updatedAt > (saved?.updatedAt ?? 0)) {
    saveAccountSettings({ car });
  }
};

onSessionChange((signedIn) => {
  if (signedIn) {
    syncWithAccount();
  }
});
if (isSignedIn()) {
  syncWithAccount();
}

// The car as chosen: { connectors, autoFilter, updatedAt }.
const chosenCar = () => car;

// Saves a new choice, here and, signed in, to the account.
const setCar = ({ connectors, autoFilter }) => {
  const next = { connectors, autoFilter, updatedAt: Date.now() };
  adopt(next);
  saveAccountSettings({ car: next });
};

// Calls `listener(car)` when the choice changes.
const onCarChange = (listener) => listeners.add(listener);

export { chosenCar, onCarChange, setCar };
