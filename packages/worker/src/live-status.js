// Live availability: how many of a charger's points are free, occupied or out
// of service. Sources that publish it are polled every few minutes (the
// */5 cron), and each source's statuses are stored as one snapshot row
// (charger_status_snapshots), so a refresh is a single write. The page asks
// for the chargers it shows: GET /api/chargers/status?ids=eipa:1,ocm:2.

import { POINT_POOLS_KEY, downloadEipa } from "./import/eipa.js";
import { loadSourceMetadata } from "./source-metadata.js";

const STATUS_PATH = "/api/chargers/status";
const MAX_IDS = 50;
// Browsers and the edge keep an answer this long; the snapshots change every
// few minutes anyway.
const STATUS_CACHE_CONTROL = "public, max-age=60";
// A Worker instance keeps the snapshots it read this long.
const SNAPSHOT_MAX_AGE_MS = 60 * 1000;

// EIPA: a point's `availability` 0 is out of service; otherwise `status` 1 is
// free and 0 occupied. Points without a status count only in the total.
const countEipaStatuses = (data, pointPools) => {
  const byCharger = {};
  for (const { point_id: pointId, status } of data) {
    const poolId = pointPools[pointId];
    if (poolId === undefined) {
      continue;
    }
    const counts = (byCharger[`eipa:${poolId}`] ??= [0, 0, 0, 0]);
    counts[3]++;
    if (!status) {
      continue;
    }
    if (status.availability === 0) {
      counts[2]++;
    } else if (status.status === 1) {
      counts[0]++;
    } else if (status.status === 0) {
      counts[1]++;
    }
  }
  return byCharger;
};

const eipaStatuses = async (env) => {
  const pointPools = await loadSourceMetadata(env.DB, "eipa", POINT_POOLS_KEY);
  if (!pointPools) {
    return null;
  }
  const { data } = await downloadEipa(env, "dynamic");
  return countEipaStatuses(data, pointPools);
};

// Sources with live statuses, if their credentials are set.
const STATUS_SOURCES = [
  { source: "eipa", isConfigured: (env) => env.EIPA_TOKEN, load: eipaStatuses },
];

const refreshStatuses = async (env) => {
  for (const { source, isConfigured, load } of STATUS_SOURCES) {
    if (!isConfigured(env)) {
      continue;
    }
    try {
      const statuses = await load(env);
      if (statuses) {
        await env.DB.prepare(
          `INSERT INTO charger_status_snapshots (source, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (source) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        )
          .bind(source, JSON.stringify(statuses), Date.now())
          .run();
        console.log(`Statuses: ${source} ${Object.keys(statuses).length} chargers`);
      }
    } catch (error) {
      console.error(`Statuses: ${source} failed:`, error.message);
    }
  }
};

const snapshots = new Map();

const snapshotOf = async (env, source) => {
  const cached = snapshots.get(source);
  if (cached && Date.now() - cached.readAt < SNAPSHOT_MAX_AGE_MS) {
    return cached;
  }
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM charger_status_snapshots WHERE source = ?"
  )
    .bind(source)
    .first();
  const snapshot = {
    statuses: row ? JSON.parse(row.data) : {},
    updatedAt: row?.updated_at ?? null,
    readAt: Date.now(),
  };
  snapshots.set(source, snapshot);
  return snapshot;
};

// { statuses: { "eipa:1": { available, occupied, outOfService, total, updatedAt } } }
// for the requested IDs that have one.
const statusResponse = async (request, env) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_IDS);
  const statuses = {};
  for (const id of ids) {
    const source = id.split(":")[0];
    if (!STATUS_SOURCES.some((status) => status.source === source)) {
      continue;
    }
    const snapshot = await snapshotOf(env, source);
    const counts = snapshot.statuses[id];
    if (counts) {
      const [available, occupied, outOfService, total] = counts;
      statuses[id] = { available, occupied, outOfService, total, updatedAt: snapshot.updatedAt };
    }
  }
  return new Response(JSON.stringify({ statuses }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": STATUS_CACHE_CONTROL,
    },
  });
};

export { STATUS_PATH, countEipaStatuses, refreshStatuses, statusResponse };
