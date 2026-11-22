// Looks up which kinds of places (src/amenities.js) are next to each charger,
// from OpenStreetMap through the Overpass API: one job per 1°×1° grid cell
// that has chargers, refreshed like the chargers.

import { amenitiesQuery, amenityMasks, parsePlaces } from "../amenities.js";
import { loadSourceMetadata, saveSourceMetadata } from "../source-metadata.js";
import { fetchOverpass } from "./openstreetmap.js";

const SOURCE = "amenities";
// After the chargers' own imports, and before the sparse cells: the places
// next to chargers matter most where the chargers (and the users, and their
// routes) are, so busy cells are imported first, instead of all cells in
// coordinate order.
const PRIORITY_BUSY = 3;
const PRIORITY_SPARSE = 4;
// A cell with at least this many chargers is busy.
const BUSY_CELL_CHARGERS = 100;
// Finding the cells with chargers reads every charger, so at most daily.
const LIST_EVERY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

const cellBounds = (area) => {
  const [south, west] = area.split(",").map(Number);
  return { south, west, north: south + 1, east: west + 1 };
};

const listJobs = async (env) => {
  const listed = await loadSourceMetadata(env.DB, SOURCE, "listed");
  if (Date.now() - (listed?.at ?? 0) < LIST_EVERY_MS) {
    return [];
  }
  // floor() for negative coordinates too, without SQLite's math functions.
  const { results } = await env.DB.prepare(
    `SELECT CAST(lat + 1000 AS INTEGER) - 1000 AS south,
                     CAST(lng + 1000 AS INTEGER) - 1000 AS west,
                     COUNT(*) AS chargers
     FROM chargers
     GROUP BY south, west`
  ).all();
  await saveSourceMetadata(env.DB, SOURCE, "listed", { at: Date.now() });
  const jobs = results.map(({ south, west, chargers }) => ({
    source: SOURCE,
    area: `${south},${west}`,
    priority: chargers >= BUSY_CELL_CHARGERS ? PRIORITY_BUSY : PRIORITY_SPARSE,
  }));
  // Already-queued jobs keep their place (a cursor in progress); only their
  // turn changes, e.g. as chargers move between cells.
  for (let index = 0; index < jobs.length; index += BATCH_SIZE) {
    await env.DB.batch(
      jobs
        .slice(index, index + BATCH_SIZE)
        .map(({ area, priority }) =>
          env.DB.prepare("UPDATE import_jobs SET priority = ? WHERE source = ? AND area = ?").bind(
            priority,
            SOURCE,
            area
          )
        )
    );
  }
  return jobs;
};

const chargersInCell = async (db, { south, west, north, east }) => {
  const { results } = await db
    .prepare(
      `SELECT chargers.rid, chargers.lat, chargers.lng, chargers.amenities
       FROM chargers_rtree JOIN chargers ON chargers.rid = chargers_rtree.id
       WHERE chargers_rtree.min_lat >= ? AND chargers_rtree.max_lat < ?
         AND chargers_rtree.min_lng >= ? AND chargers_rtree.max_lng < ?`
    )
    .bind(south, north, west, east)
    .all();
  return results;
};

// Looks at a whole cell in one step; only chargers whose places changed are
// written.
const runStep = async (env, job) => {
  const bounds = cellBounds(job.area);
  const chargers = await chargersInCell(env.DB, bounds);
  if (!chargers.length) {
    return { done: true };
  }
  const places = parsePlaces(await fetchOverpass(amenitiesQuery(bounds)));
  const masks = amenityMasks(chargers, places, bounds.south + 0.5);
  const changed = chargers
    .map((charger, index) => ({ rid: charger.rid, mask: masks[index], before: charger.amenities }))
    .filter(({ mask, before }) => mask !== before);
  for (let index = 0; index < changed.length; index += BATCH_SIZE) {
    await env.DB.batch(
      changed
        .slice(index, index + BATCH_SIZE)
        .map(({ rid, mask }) =>
          env.DB.prepare("UPDATE chargers SET amenities = ? WHERE rid = ?").bind(mask, rid)
        )
    );
  }
  console.log(
    `Amenities: ${job.area}: ${places.length} places, ${changed.length} of ${chargers.length} chargers changed`
  );
  return { done: true };
};

export { listJobs, runStep, SOURCE };
