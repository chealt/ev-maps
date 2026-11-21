// Live availability: how many of a charger's points are free, occupied or out
// of service. Sources that publish it are polled every few minutes (the */5
// cron, or less often for some), and each source's statuses are stored as a
// few snapshot rows (charger_status_snapshots, split by charger ID), so a
// refresh is a few writes. The page asks for the chargers it shows:
// GET /api/chargers/status?ids=eipa:1,ocm:2.

import { POINT_POOLS_KEY, downloadEipa } from "./import/eipa.js";
import { partOf, splitByPart } from "./partitions.js";
import { loadSourceMetadata } from "./source-metadata.js";

const STATUS_PATH = "/api/chargers/status";
const MAX_IDS = 50;
// The browser keeps an answer this long (only the browser: it's for a
// signed-in user); the snapshots change every few minutes anyway.
const STATUS_CACHE_CONTROL = "private, max-age=60";
// A Worker instance keeps the snapshot parts it read this long.
const SNAPSHOT_MAX_AGE_MS = 60 * 1000;
// The */5 cron's interval; sources refresh every multiple of it.
const CRON_MINUTES = 5;

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

// Sources with live statuses, if their credentials are set, and how often to
// refresh each (a multiple of CRON_MINUTES).
const STATUS_SOURCES = [
  { source: "eipa", isConfigured: (env) => env.EIPA_TOKEN, everyMinutes: 5, load: eipaStatuses },
];

const isDue = ({ everyMinutes }, scheduledTime) =>
  (Math.floor(new Date(scheduledTime).getUTCMinutes() / CRON_MINUTES) * CRON_MINUTES) %
    everyMinutes ===
  0;

const saveSnapshot = async (env, source, statuses) => {
  const now = Date.now();
  await env.DB.batch(
    splitByPart(statuses).map((data, part) =>
      env.DB.prepare(
        `INSERT INTO charger_status_snapshots (source, part, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (source, part) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind(source, part, JSON.stringify(data), now)
    )
  );
};

// Refreshes the sources due at `scheduledTime` (every source without one).
const refreshStatuses = async (env, scheduledTime) => {
  for (const status of STATUS_SOURCES) {
    if (!status.isConfigured(env) || (scheduledTime && !isDue(status, scheduledTime))) {
      continue;
    }
    try {
      const statuses = await status.load(env);
      if (statuses) {
        await saveSnapshot(env, status.source, statuses);
        console.log(`Statuses: ${status.source} ${Object.keys(statuses).length} chargers`);
      }
    } catch (error) {
      console.error(`Statuses: ${status.source} failed:`, error.message);
    }
  }
};

const snapshots = new Map();

// One part of a source's statuses, kept for a minute.
const snapshotOf = async (env, source, part) => {
  const key = `${source}:${part}`;
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.readAt < SNAPSHOT_MAX_AGE_MS) {
    return cached;
  }
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM charger_status_snapshots WHERE source = ? AND part = ?"
  )
    .bind(source, part)
    .first();
  const snapshot = {
    statuses: row ? JSON.parse(row.data) : {},
    updatedAt: row?.updated_at ?? null,
    readAt: Date.now(),
  };
  snapshots.set(key, snapshot);
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
    const snapshot = await snapshotOf(env, source, partOf(id));
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

export { STATUS_PATH, countEipaStatuses, isDue, refreshStatuses, statusResponse };
