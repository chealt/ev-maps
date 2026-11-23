// The maps app "Open in maps" opens a charger in: Google Maps,
// OpenStreetMap or Apple Maps. Unless the user remembered one (in the
// dialog, or in the account menu), it asks every time.
//
// The choice is kept in memory, so a click can open the app at once (a new
// tab opened later than the click itself is blocked as a popup); on this
// device (localStorage); and, signed in, in the account (the Worker's
// settings, section `mapsApp`), where the newer of the two wins.

import { fetchAccountSettings, saveAccountSettings } from "./account-settings.js";
import { isSignedIn, onSessionChange } from "./session.js";

const MAPS_APP_KEY = "ev-maps:maps-app";
const MAPS_APPS = ["google", "osm", "apple"];

// A charger's location in each app, with its name where the app shows one.
const MAPS_APP_URLS = {
  google: ({ lat, lng }) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
  osm: ({ lat, lng }) =>
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`,
  apple: ({ lat, lng }, name) =>
    `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name || `${lat},${lng}`)}`,
};

const isMapsApp = (app) => app === null || MAPS_APPS.includes(app);

// { app, updatedAt }: app null asks every time; updatedAt 0 is never chosen.
const readLocal = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(MAPS_APP_KEY));
    if (isMapsApp(saved?.app) && Number.isFinite(saved?.updatedAt)) {
      return saved;
    }
  } catch {
    // Storage can be unavailable, or hold something else.
  }
  return { app: null, updatedAt: 0 };
};

const saveLocal = (choice) => {
  try {
    localStorage.setItem(MAPS_APP_KEY, JSON.stringify(choice));
  } catch {
    // Storage can be unavailable; the choice lasts until the page is left.
  }
};

let choice = readLocal();
const listeners = new Set();

// The remembered app, or null to ask.
const mapsApp = () => choice.app;

// Calls `listener(app)` when the remembered app changes.
const onMapsAppChange = (listener) => {
  listeners.add(listener);
};

const adopt = (next) => {
  choice = next;
  saveLocal(choice);
  for (const listener of listeners) {
    listener(choice.app);
  }
};

// Remembers `app` (null: ask every time), here and in the account.
const setMapsApp = (app) => {
  adopt({ app, updatedAt: Date.now() });
  if (isSignedIn()) {
    saveAccountSettings({ mapsApp: choice });
  }
};

// Signed in: the account's choice if it's newer, else this device's to the
// account.
const syncWithAccount = async () => {
  const saved = (await fetchAccountSettings())?.mapsApp;
  if (isMapsApp(saved?.app) && saved.updatedAt > choice.updatedAt) {
    adopt({ app: saved.app, updatedAt: saved.updatedAt });
  } else if (choice.updatedAt > (saved?.updatedAt ?? 0)) {
    saveAccountSettings({ mapsApp: choice });
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

const mapsAppUrl = (app, location, name) => MAPS_APP_URLS[app](location, name);

export { MAPS_APPS, mapsApp, mapsAppUrl, onMapsAppChange, setMapsApp };
