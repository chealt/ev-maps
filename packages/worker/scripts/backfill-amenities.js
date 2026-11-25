// One-off backfill: run the amenities lookup (src/amenities.js) for the
// given 1°×1° cells ("south,west") against the production database, so
// chargers there get their place kinds without waiting for the scheduled
// import. Usage:
//   bun scripts/backfill-amenities.js 49,19 49,20 ...
//
// Like the scheduled import (src/import/amenities.js), each cell is looked
// up a quadrant at a time: the Overpass mirrors refuse a whole busy cell's
// query. A cell whose quadrants all succeeded is marked finished in
// import_jobs, so the scheduled import skips it.

import { amenitiesQuery, amenityMasks, parsePlaces } from "../src/amenities.js";
import { fetchOverpass } from "../src/import/openstreetmap.js";
import { QUADRANTS, quadrantOf } from "../src/import/amenities.js";

const cells = process.argv.slice(2);
if (!cells.length) {
  console.error("Usage: bun scripts/backfill-amenities.js <south,west> ...");
  process.exit(1);
}

const d1 = async (command) => {
  const { stdout } = Bun.spawnSync(
    ["bunx", "wrangler", "d1", "execute", "ev-maps", "--remote", "--json", "--command", command],
    { cwd: new URL("..", import.meta.url).pathname }
  );
  const output = stdout.toString();
  const parsed = JSON.parse(output);
  return parsed.flatMap((part) => part.results ?? []);
};

const executeSql = async (statements) => {
  const file = Bun.file(`/tmp/backfill-${Date.now()}.sql`);
  const blob = new Blob([statements.join("\n")]);
  await Bun.write(file, blob);
  const { exitCode, stderr } = Bun.spawnSync(
    ["bunx", "wrangler", "d1", "execute", "ev-maps", "--remote", "--file", file.name],
    { cwd: new URL("..", import.meta.url).pathname }
  );
  if (exitCode !== 0) {
    throw new Error(`d1 execute failed: ${stderr.toString()}`);
  }
};

const fetchWithRetries = async (label, query) => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fetchOverpass(query);
    } catch (error) {
      console.log(`${label}: attempt ${attempt} failed (${error.message}); waiting`);
      await Bun.sleep(30_000);
    }
  }
  return null;
};

const inBox = ({ lat, lng }, { south, north, west, east }) =>
  lat >= south && lat < north && lng >= west && lng < east;

for (const area of cells) {
  const [south, west] = area.split(",").map(Number);
  const cell = { south, west, north: south + 1, east: west + 1 };
  const chargers = await d1(
    `SELECT chargers.rid, chargers.lat, chargers.lng, chargers.amenities
     FROM chargers_rtree JOIN chargers ON chargers.rid = chargers_rtree.id
     WHERE chargers_rtree.min_lat >= ${south} AND chargers_rtree.max_lat < ${south + 1}
       AND chargers_rtree.min_lng >= ${west} AND chargers_rtree.max_lng < ${west + 1}`
  );
  if (!chargers.length) {
    console.log(`${area}: no chargers`);
    continue;
  }
  const updates = [];
  let failed = false;
  for (let index = 0; index < QUADRANTS; index++) {
    const box = quadrantOf(cell, index);
    const targets = chargers.filter((charger) => inBox(charger, box));
    if (!targets.length) {
      continue;
    }
    const elements = await fetchWithRetries(`${area} quadrant ${index + 1}`, amenitiesQuery(box));
    if (!elements) {
      console.error(`${area} quadrant ${index + 1}: giving up`);
      failed = true;
      continue;
    }
    const places = parsePlaces(elements);
    const masks = amenityMasks(targets, places, (box.south + box.north) / 2);
    const changed = targets
      .map((charger, at) => ({ rid: charger.rid, mask: masks[at], before: charger.amenities }))
      .filter(({ mask, before }) => mask !== before);
    updates.push(...changed);
    console.log(
      `${area} quadrant ${index + 1}: ${places.length} places, ${changed.length} of ${targets.length} chargers changed`
    );
  }
  const statements = updates.map(
    ({ rid, mask }) => `UPDATE chargers SET amenities = ${mask} WHERE rid = ${rid};`
  );
  if (!failed) {
    statements.push(
      `UPDATE import_jobs SET cursor = NULL, started_at = NULL, finished_at = ${Date.now()}, error = NULL
       WHERE source = 'amenities' AND area = '${area}';`
    );
  }
  if (statements.length) {
    await executeSql(statements);
  }
  console.log(
    `${area}: ${updates.length} of ${chargers.length} chargers updated${failed ? " (unfinished quadrants left for the scheduled import)" : ""}`
  );
}
