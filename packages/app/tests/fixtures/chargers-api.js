import { readFile } from "node:fs/promises";
import { tileBounds } from "../../src/lib/tiles.js";

const fixtureChargers = JSON.parse(await readFile(new URL("./chargers.json", import.meta.url)));

// A request's tile, from /api/chargers/{z}/{x}/{y}.
const tileOf = (url) => {
  const [zoom, x, y] = url.pathname.split("/").slice(-3).map(Number);
  return { zoom, x, y };
};

const tileWidth = (url) => 360 / 2 ** tileOf(url).zoom;

const requestCovers = (url, { lat, lng }) => {
  const { north, south, east, west } = tileBounds(tileOf(url));
  return lat >= south && lat <= north && lng >= west && lng <= east;
};

// Serves the fixture chargers (or `chargers`) for every charger tile and
// records the requested tile URLs. Tiles wider than `fullTilesWiderThan`
// degrees say they're full, as if the area had more chargers than one tile
// holds. Routes on the browser context, so it also fakes requests made by
// the service worker.
const fakeChargersApi = async (
  page,
  { chargers = fixtureChargers, fullTilesWiderThan = Infinity } = {}
) => {
  const requests = [];
  await page.context().route("**/api/chargers/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const full = tileWidth(url) > fullTilesWiderThan;
    // Full tiles get their own chargers, so splitting them adds new ones.
    const tileChargers = full
      ? chargers.map((charger) => ({ ...charger, id: `${charger.id}@${url.pathname}` }))
      : chargers;
    return route.fulfill({ json: { chargers: tileChargers, full } });
  });
  return requests;
};

export { fakeChargersApi, requestCovers, tileWidth };
