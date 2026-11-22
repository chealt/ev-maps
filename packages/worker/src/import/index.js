// Runs the charger import in resumable steps. Each scheduled run works through
// due jobs (never imported, or last finished over a week ago) until its time
// budget is spent; a job's cursor lets the next run continue a big country.

import { recordWorkerError } from "../errors.js";
import * as amenities from "./amenities.js";
import * as eipa from "./eipa.js";
import * as irve from "./irve.js";
import * as openChargeMap from "./open-charge-map.js";
import * as openStreetMap from "./openstreetmap.js";

const SOURCES = {
  [eipa.SOURCE]: eipa,
  [irve.SOURCE]: irve,
  [openChargeMap.SOURCE]: openChargeMap,
  [openStreetMap.SOURCE]: openStreetMap,
  [amenities.SOURCE]: amenities,
};
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
// Scheduled runs may use up to 15 minutes; leave room to finish a step.
const RUN_BUDGET_MS = 10 * 60 * 1000;
// Overpass and Open Charge Map are shared services: pause between steps.
const PAUSE_BETWEEN_STEPS_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Adds jobs for new areas (e.g. a country Open Charge Map started listing).
const ensureJobs = async (env) => {
  for (const source of Object.values(SOURCES)) {
    const jobs = await source.listJobs(env);
    for (let index = 0; index < jobs.length; index += 50) {
      await env.DB.batch(
        jobs
          .slice(index, index + 50)
          .map(({ source: name, area, priority }) =>
            env.DB.prepare(
              "INSERT OR IGNORE INTO import_jobs (source, area, priority) VALUES (?, ?, ?)"
            ).bind(name, area, priority)
          )
      );
    }
  }
};

const nextJob = (env, now, skipped) =>
  env.DB.prepare(
    `SELECT * FROM import_jobs
     WHERE (finished_at IS NULL OR finished_at < ?)
       AND (source || ':' || area) NOT IN (SELECT value FROM json_each(?))
     ORDER BY cursor IS NULL, priority, finished_at IS NOT NULL, finished_at, source, area
     LIMIT 1`
  )
    .bind(now - REFRESH_AFTER_MS, JSON.stringify([...skipped]))
    .first();

const runImport = async (env, { budgetMs = RUN_BUDGET_MS } = {}) => {
  const deadline = Date.now() + budgetMs;
  const skipped = new Set();
  try {
    await ensureJobs(env);
  } catch (error) {
    console.error("Import: listing jobs failed:", error);
    await recordWorkerError(env, error, { context: "import: listing jobs" });
  }

  while (Date.now() < deadline) {
    const now = Date.now();
    const job = await nextJob(env, now, skipped);
    if (!job) {
      console.log("Import: nothing due");
      return;
    }
    // A job keeps its start time until it finishes: chargers not seen since
    // then are the ones its area no longer lists.
    const startedAt = job.cursor ? job.started_at : now;
    try {
      const { done, cursor } = await SOURCES[job.source].runStep(env, {
        ...job,
        started_at: startedAt,
      });
      await env.DB.prepare(
        `UPDATE import_jobs SET cursor = ?, started_at = ?, finished_at = ?, error = NULL
         WHERE source = ? AND area = ?`
      )
        .bind(
          done ? null : cursor,
          done ? null : startedAt,
          done ? Date.now() : job.finished_at,
          job.source,
          job.area
        )
        .run();
      console.log(
        `Import: ${job.source} ${job.area} ${done ? "finished" : `continues after ${cursor}`}`
      );
    } catch (error) {
      console.error(`Import: ${job.source} ${job.area} failed:`, error.message);
      await recordWorkerError(env, error, { context: `import ${job.source} ${job.area}` });
      // Try the job again in a later run; move on to others now.
      skipped.add(`${job.source}:${job.area}`);
      await env.DB.prepare("UPDATE import_jobs SET error = ? WHERE source = ? AND area = ?")
        .bind(String(error.message).slice(0, 500), job.source, job.area)
        .run();
    }
    await sleep(PAUSE_BETWEEN_STEPS_MS);
  }
};

export { runImport };
