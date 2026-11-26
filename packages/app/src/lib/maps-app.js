// The maps app a charger's address links to: Google Maps, OpenStreetMap or
// Apple Maps, chosen in the account menu; Google Maps until then.
//
// The choice is kept on this device (localStorage) and, signed in, in the
// account (the Worker's settings, section `mapsApp`), where the newer of
// the two wins.

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

// The chosen app.
const mapsApp = () => preference.get() ?? "google";
// Remembers `app`, here and in the account.
const setMapsApp = preference.set;
// Calls `listener(app)` when the remembered app changes.
const onMapsAppChange = preference.onChange;

const mapsAppUrl = (app, location, name) => MAPS_APP_URLS[app](location, name);

export { MAPS_APPS, mapsApp, mapsAppUrl, onMapsAppChange, setMapsApp };
