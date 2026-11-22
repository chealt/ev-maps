import { describe, expect, test } from "bun:test";
import { testD1 } from "../test-d1.js";
import { upsertChargers } from "../db.js";
import { listJobs, SOURCE } from "./amenities.js";

const db = () => {
  const database = testD1(
    "../migrations/0001_chargers.sql",
    "../migrations/0003_live_status.sql",
    "../migrations/0006_charger_amenities.sql"
  );
  return { ...database, batch: (statements) => Promise.all(statements.map((s) => s.run())) };
};

const charger = (sourceId, lat, lng) => ({
  source: "ocm",
  sourceId,
  country: "HU",
  name: `Charger ${sourceId}`,
  lat,
  lng,
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
});

describe("amenities listJobs", () => {
  test("lists busy cells before sparse ones, and re-prioritizes queued jobs", async () => {
    const env = { DB: db() };
    await upsertChargers(
      env.DB,
      [
        // A busy cell around Budapest: 100 chargers.
        ...Array.from({ length: 100 }, (_, index) =>
          charger(`busy-${index}`, 47 + (index % 10) / 100, 19 + Math.floor(index / 10) / 100)
        ),
        // A sparse cell around Ulaanbaatar.
        charger("sparse-1", 47.9, 106.9),
        charger("sparse-2", 47.8, 106.8),
      ],
      Date.now()
    );

    const jobs = await listJobs(env);
    expect(jobs).toEqual([
      { source: SOURCE, area: "47,19", priority: 3 },
      { source: SOURCE, area: "47,106", priority: 4 },
    ]);

    // The runner queues the listed jobs (import/index.js ensureJobs).
    for (const { source, area, priority } of jobs) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO import_jobs (source, area, priority) VALUES (?, ?, ?)"
      )
        .bind(source, area, priority)
        .run();
    }

    // The first listing queued the jobs; the next one (a day later) only
    // updates their turn, keeping any progress.
    await env.DB.prepare(
      "UPDATE import_jobs SET cursor = 'underway', priority = 4 WHERE source = ? AND area = ?"
    )
      .bind(SOURCE, "47,19")
      .run();
    await env.DB.prepare("DELETE FROM source_metadata WHERE source = ?").bind(SOURCE).run();
    await listJobs(env);
    const priorities = await env.DB.prepare(
      "SELECT area, priority, cursor FROM import_jobs WHERE source = ? ORDER BY area"
    )
      .bind(SOURCE)
      .all();
    expect(priorities.results).toEqual([
      { area: "47,106", priority: 4, cursor: null },
      { area: "47,19", priority: 3, cursor: "underway" },
    ]);
  });
});
