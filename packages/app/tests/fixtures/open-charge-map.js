import { readFile } from "node:fs/promises";

const chargers = JSON.parse(await readFile(new URL("./open-charge-map.json", import.meta.url)));

// Serves the fixture chargers for every Open Charge Map request and records the
// requested URLs. With `fillTiles`, each tile returns as many chargers as it
// asked for, as if the area had more than the per-tile limit.
const fakeOpenChargeMap = async (page, { fillTiles = false } = {}) => {
  const requests = [];
  await page.route("https://api.openchargemap.io/v3/poi?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const body = fillTiles
      ? Array.from({ length: Number(url.searchParams.get("maxresults")) }, (_, index) => ({
          ...chargers[0],
          ID: `${url.searchParams.get("boundingbox")}-${index}`,
        }))
      : chargers;
    return route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } });
  });
  return requests;
};

// Whether a request's bounding box, "(south,west),(north,east)", covers a point.
const requestCovers = (url, { lat, lng }) => {
  const [south, west, north, east] = url.searchParams
    .get("boundingbox")
    .match(/-?[\d.]+/g)
    .map(Number);
  return lat >= south && lat <= north && lng >= west && lng <= east;
};

export { fakeOpenChargeMap, requestCovers };
