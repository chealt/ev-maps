import { tileBounds } from "@ev-maps/tiles";
import fixtureChargers from "./chargers.json" with { type: "json" };

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

// Serves `chargers` for every route, placed on its points in order, each
// `kmApart` along it and 1 km off it, and records the requests' bodies. The
// route is one `kmApart` longer than its last charger.
const fakeRouteChargersApi = async (page, { chargers = fixtureChargers, kmApart = 50 } = {}) => {
  const requests = [];
  await page.context().route("**/api/chargers/route", (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const step = Math.floor(body.path.length / (chargers.length + 1));
    return route.fulfill({
      json: {
        chargers: chargers.map((charger, index) => ({
          ...charger,
          location: {
            lat: body.path[(index + 1) * step][0],
            lng: body.path[(index + 1) * step][1],
          },
          route: {
            distanceFromStartMeters: (index + 1) * kmApart * 1000,
            distanceToEndMeters: (chargers.length - index) * kmApart * 1000,
            distanceFromRouteMeters: 1000,
          },
        })),
        full: false,
      },
    });
  });
  return requests;
};

// Serves `statuses` (by charger ID) for live availability, and records the
// IDs each request asked for.
const fakeStatusApi = async (page, statuses = {}) => {
  const requests = [];
  await page.context().route("**/api/chargers/status?**", (route) => {
    const ids = new URL(route.request().url()).searchParams.get("ids").split(",");
    requests.push(ids);
    return route.fulfill({
      json: {
        statuses: Object.fromEntries(
          ids.filter((id) => statuses[id]).map((id) => [id, statuses[id]])
        ),
      },
    });
  });
  return requests;
};

export { fakeChargersApi, fakeRouteChargersApi, fakeStatusApi, requestCovers, tileWidth };
