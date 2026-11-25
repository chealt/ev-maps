// Looks up which kinds of places (src/amenities.js) are next to each charger,
// from OpenStreetMap through the Overpass API: one job per 1°×1° grid cell
// that has chargers, refreshed like the chargers.

import { amenitiesQuery, amenityMasks, parsePlaces } from "../amenities.js";
import { loadSourceMetadata, saveSourceMetadata } from "../source-metadata.js";
import { fetchOverpass } from "./openstreetmap.js";

const SOURCE = "amenities";
// After the chargers' own imports, and before the sparse cells: the places
// next to chargers matter most where the chargers (and the users, and their
// routes) are, so cells with more chargers are imported first, instead of
// all cells in coordinate order.
const PRIORITY_BUSY = 3;
const PRIORITY_SPARSE = 4;
const PRIORITY_QUIET = 5;
// A cell with at least this many chargers is busy: one Overpass query per
// quadrant, not per whole cell, as the mirrors refuse the big one (and
// minutes are lost on each refusal).
const BUSY_CELL_CHARGERS = 100;
// Below this a cell barely has chargers to look around: after the sparse ones.
const QUIET_CELL_CHARGERS = 10;
// A busy cell's Overpass query runs on one quadrant at a time, this many in
// all.
const QUADRANTS = 4;
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
    priority:
      chargers >= BUSY_CELL_CHARGERS
        ? PRIORITY_BUSY
        : chargers >= QUIET_CELL_CHARGERS
          ? PRIORITY_SPARSE
          : PRIORITY_QUIET,
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

// The quadrant's box, splitting the cell in two each way; the chargers in
// it. A charger's quadrant is the one containing it, so every charger is
// looked at exactly once; the query's margin reaches places over the border.
const quadrantOf = (cell, index) => {
  const midLat = (cell.south + cell.north) / 2;
  const midLng = (cell.west + cell.east) / 2;
  const southHalf = index < QUADRANTS / 2;
  const westHalf = index % 2 === 0;
  return {
    south: southHalf ? cell.south : midLat,
    north: southHalf ? midLat : cell.north,
    west: westHalf ? cell.west : midLng,
    east: westHalf ? midLng : cell.east,
  };
};

const inBox = ({ lat, lng }, { south, north, west, east }) =>
  lat >= south && lat < north && lng >= west && lng < east;

// Looks at a cell's places, a quadrant at a time when it's busy (the
// mirrors refuse a whole busy cell's query); only chargers whose places
// changed are written. `job.cursor` says which quadrant is next.
const runStep = async (env, job) => {
  const bounds = cellBounds(job.area);
  const chargers = await chargersInCell(env.DB, bounds);
  if (!chargers.length) {
    return { done: true };
  }
  const next = Number(job.cursor ?? 0);
  const split = job.cursor != null || chargers.length >= BUSY_CELL_CHARGERS;
  if (split && next >= QUADRANTS) {
    return { done: true };
  }
  const box = split ? quadrantOf(bounds, next) : bounds;
  const targets = split ? chargers.filter((charger) => inBox(charger, box)) : chargers;
  const places = parsePlaces(await fetchOverpass(amenitiesQuery(box)));
  const masks = amenityMasks(targets, places, (box.south + box.north) / 2);
  const changed = targets
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
    `Amenities: ${job.area}${split ? ` quadrant ${next + 1}/${QUADRANTS}` : ""}: ${places.length} places, ${changed.length} of ${targets.length} chargers changed`
  );
  return split ? { done: next + 1 === QUADRANTS, cursor: next + 1 } : { done: true };
};

export { listJobs, QUADRANTS, quadrantOf, runStep, SOURCE };
