// Looks up which kinds of places (src/amenities.js) are next to each charger,
// from OpenStreetMap through the Overpass API: one job per 1°×1° grid cell
// that has chargers, refreshed like the chargers.

import { amenitiesQuery, amenityMasks, parsePlaces } from "../amenities.js";
import { loadSourceMetadata, saveSourceMetadata } from "../source-metadata.js";
import { fetchOverpass } from "./openstreetmap.js";

const SOURCE = "amenities";
// After the chargers' own imports.
const PRIORITY = 3;
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
    `SELECT DISTINCT CAST(lat + 1000 AS INTEGER) - 1000 AS south,
                     CAST(lng + 1000 AS INTEGER) - 1000 AS west
     FROM chargers`
  ).all();
  await saveSourceMetadata(env.DB, SOURCE, "listed", { at: Date.now() });
  return results.map(({ south, west }) => ({
    source: SOURCE,
    area: `${south},${west}`,
    priority: PRIORITY,
  }));
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
