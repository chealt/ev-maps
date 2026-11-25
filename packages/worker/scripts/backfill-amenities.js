// One-off backfill: run the amenities lookup (src/amenities.js) for the
// given 1°×1° cells ("south,west") against the production database, so
// chargers there get their place kinds without waiting for the scheduled
// import. Usage:
//   bun scripts/backfill-amenities.js 49,19 49,20 ...

import { amenitiesQuery, amenityMasks, parsePlaces } from "../src/amenities.js";
import { fetchOverpass } from "../src/import/openstreetmap.js";

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

for (const area of cells) {
  const [south, west] = area.split(",").map(Number);
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
  const query = amenitiesQuery({ south, west, north: south + 1, east: west + 1 });
  let elements = null;
  for (let attempt = 1; attempt <= 5 && !elements; attempt++) {
    try {
      elements = await fetchOverpass(query);
    } catch (error) {
      console.log(`${area}: attempt ${attempt} failed (${error.message}); waiting`);
      await Bun.sleep(30_000);
    }
  }
  if (!elements) {
    console.error(`${area}: giving up`);
    continue;
  }
  const places = parsePlaces(elements);
  const masks = amenityMasks(chargers, places, south + 0.5);
  const changed = chargers
    .map((charger, index) => ({ rid: charger.rid, mask: masks[index], before: charger.amenities }))
    .filter(({ mask, before }) => mask !== before);
  const statements = [
    ...changed.map(
      ({ rid, mask }) => `UPDATE chargers SET amenities = ${mask} WHERE rid = ${rid};`
    ),
    `UPDATE import_jobs SET cursor = NULL, started_at = NULL, finished_at = ${Date.now()}, error = NULL
     WHERE source = 'amenities' AND area = '${area}';`,
  ];
  if (statements.length > 1) {
    await executeSql(statements);
  }
  console.log(
    `${area}: ${places.length} places, ${changed.length} of ${chargers.length} chargers updated`
  );
}
