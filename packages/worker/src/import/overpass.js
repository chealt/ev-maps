// The Overpass API (OpenStreetMap's query service), through public mirrors:
// the chargers (openstreetmap.js) and the places next to them (amenities.js).

import { overpassClient } from "./overpass-client.js";

// Public Overpass instances are often overloaded; try them in turn.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Overpass queries time out on the server (60 s for chargers, 120 s for the
// places next to them: a big city's cell took 40 s); an overloaded instance
// may never answer, which would block the whole import run.
const REQUEST_TIMEOUT_MS = 150 * 1000;

const fetchOverpass = overpassClient({ urls: OVERPASS_URLS, timeoutMs: REQUEST_TIMEOUT_MS });

export { fetchOverpass };
