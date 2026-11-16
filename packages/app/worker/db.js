// D1 access for chargers. A charger here is the normalized shape every
// importer produces:
// { source, sourceId, country, name, lat, lng, address, operator, usageType,
//   usageCost, status, numberOfPoints, maxPowerKw, connectors, license }

// D1 runs a batch in one round trip; keep batches modest.
const BATCH_SIZE = 50;

const upsertStatement = (db, charger, seenAt) =>
  db
    .prepare(
      `INSERT INTO chargers (source, source_id, country, name, lat, lng, address, operator,
         usage_type, usage_cost, status, number_of_points, max_power_kw, connectors, license, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (source, source_id) DO UPDATE SET
         country = excluded.country, name = excluded.name, lat = excluded.lat,
         lng = excluded.lng, address = excluded.address, operator = excluded.operator,
         usage_type = excluded.usage_type, usage_cost = excluded.usage_cost,
         status = excluded.status, number_of_points = excluded.number_of_points,
         max_power_kw = excluded.max_power_kw, connectors = excluded.connectors,
         license = excluded.license, seen_at = excluded.seen_at`
    )
    .bind(
      charger.source,
      charger.sourceId,
      charger.country ?? null,
      charger.name ?? null,
      charger.lat,
      charger.lng,
      charger.address ?? null,
      charger.operator ?? null,
      charger.usageType ?? null,
      charger.usageCost ?? null,
      charger.status ?? null,
      charger.numberOfPoints ?? null,
      charger.maxPowerKw ?? null,
      JSON.stringify(charger.connectors ?? []),
      charger.license ?? null,
      seenAt
    );

const rtreeStatement = (db, charger) =>
  db
    .prepare(
      `INSERT OR REPLACE INTO chargers_rtree (id, min_lat, max_lat, min_lng, max_lng)
       SELECT rid, lat, lat, lng, lng FROM chargers WHERE source = ? AND source_id = ?`
    )
    .bind(charger.source, charger.sourceId);

const upsertChargers = async (db, chargers, seenAt) => {
  for (let index = 0; index < chargers.length; index += BATCH_SIZE) {
    const batch = chargers.slice(index, index + BATCH_SIZE);
    await db.batch(
      batch.flatMap((charger) => [
        upsertStatement(db, charger, seenAt),
        rtreeStatement(db, charger),
      ])
    );
  }
};

// Removes a source's chargers in an area that the latest import didn't list.
// `where` is an SQL condition on the chargers table with its parameters.
const deleteUnseen = async (db, { source, where, params, seenBefore }) => {
  const condition = `source = ? AND seen_at < ? AND ${where}`;
  const values = [source, seenBefore, ...params];
  await db.batch([
    db
      .prepare(
        `DELETE FROM chargers_rtree WHERE id IN (SELECT rid FROM chargers WHERE ${condition})`
      )
      .bind(...values),
    db.prepare(`DELETE FROM chargers WHERE ${condition}`).bind(...values),
  ]);
};

// The shape the client uses (see src/components/google-map/chargers.js).
const toClientCharger = (row) => ({
  id: `${row.source}:${row.source_id}`,
  source: row.source,
  name: row.name || "EV charger",
  location: { lat: row.lat, lng: row.lng },
  address: row.address ?? "",
  operator: row.operator ?? undefined,
  usageType: row.usage_type ?? undefined,
  usageCost: row.usage_cost ?? undefined,
  status: row.status ?? undefined,
  numberOfPoints: row.number_of_points ?? undefined,
  maxPowerKw: row.max_power_kw ?? null,
  connectors: JSON.parse(row.connectors || "[]"),
});

// Chargers inside a bounding box, via the R*Tree index. Asks for one more
// than `limit` so callers can tell the area was cut off.
const chargersInBounds = async (db, { north, south, east, west }, limit) => {
  const { results } = await db
    .prepare(
      `SELECT c.* FROM chargers_rtree r JOIN chargers c ON c.rid = r.id
       WHERE r.max_lat >= ? AND r.min_lat <= ? AND r.max_lng >= ? AND r.min_lng <= ?
       LIMIT ?`
    )
    .bind(south, north, west, east, limit + 1)
    .all();
  return { rows: results.slice(0, limit), full: results.length > limit };
};

export { chargersInBounds, deleteUnseen, toClientCharger, upsertChargers };
