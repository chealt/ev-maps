// The maps app "Open in maps" opens a charger in: Google Maps,
// OpenStreetMap or Apple Maps. Unless the user remembered one (in the
// dialog, or in the account menu), it asks every time.
//
// The choice is kept in memory, so a click can open the app at once (a new
// tab opened later than the click itself is blocked as a popup); on this
// device (localStorage); and, signed in, in the account (the Worker's
// settings, section `mapsApp`), where the newer of the two wins.

import { createAccountPreference } from "./account-preference.js";

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

const preference = createAccountPreference({
  storageKey: "ev-maps:maps-app",
  section: "mapsApp",
  field: "app",
  values: MAPS_APPS,
});

// The remembered app, or null to ask.
const mapsApp = preference.get;
// Remembers `app` (null: ask every time), here and in the account.
const setMapsApp = preference.set;
// Calls `listener(app)` when the remembered app changes.
const onMapsAppChange = preference.onChange;

const mapsAppUrl = (app, location, name) => MAPS_APP_URLS[app](location, name);

export { MAPS_APPS, mapsApp, mapsAppUrl, onMapsAppChange, setMapsApp };
