import { readFile } from "node:fs/promises";

const readFixture = async (name) =>
  JSON.parse(await readFile(new URL(`./${name}`, import.meta.url)));

const [chargers, referenceData] = await Promise.all([
  readFixture("open-charge-map.json"),
  readFixture("open-charge-map-reference.json"),
]);

// Serves the fixture chargers for every Open Charge Map tile request and
// records the requested tile URLs. It routes on the browser context, so it
// also fakes requests made by the service worker. Tiles wider than `fullTilesWiderThan`
// degrees return as many chargers as they asked for, as if the area had more
// than the per-tile limit.
const fakeOpenChargeMap = async (page, { fullTilesWiderThan = Infinity } = {}) => {
  const requests = [];
  await page
    .context()
    .route("https://api.openchargemap.io/v3/referencedata?**", (route) =>
      route.fulfill({ json: referenceData, headers: { "access-control-allow-origin": "*" } })
    );
  await page.context().route("https://api.openchargemap.io/v3/poi?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const body =
      tileWidth(url) > fullTilesWiderThan
        ? Array.from({ length: Number(url.searchParams.get("maxresults")) }, (_, index) => ({
            ...chargers[0],
            ID: `${url.searchParams.get("boundingbox")}-${index}`,
          }))
        : chargers;
    return route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } });
  });
  return requests;
};

// A request's bounding box, "(south,west),(north,east)".
const boundingBox = (url) => {
  const [south, west, north, east] = url.searchParams
    .get("boundingbox")
    .match(/-?[\d.]+/g)
    .map(Number);
  return { south, west, north, east };
};

const tileWidth = (url) => {
  const { west, east } = boundingBox(url);
  return east - west;
};

const requestCovers = (url, { lat, lng }) => {
  const { south, west, north, east } = boundingBox(url);
  return lat >= south && lat <= north && lng >= west && lng <= east;
};

export { fakeOpenChargeMap, requestCovers, tileWidth };
