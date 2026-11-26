import { describe, expect, mock, test } from "bun:test";
import { testD1 } from "../test-d1.js";
import { upsertChargers } from "../db.js";

// The Overpass answers, and the queries asked: a runStep's fetchOverpass is
// replaced with this.
const overpassQueries = [];
let overpassElements = [];
// Queries this says no to fail, as an overloaded mirror would.
let overpassRefuses = () => false;
mock.module("./openstreetmap.js", () => ({
  fetchOverpass: async (query) => {
    overpassQueries.push(query);
    if (overpassRefuses(query)) {
      throw new Error("Overpass failed: maps.mail.ru: 504");
    }
    return overpassElements;
  },
}));

const { doneQuadrants, listJobs, quadrantOf, runStep, SOURCE } = await import("./amenities.js");

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
        ...Array.from({ length: 10 }, (_, index) =>
          charger(`sparse-${index}`, 47.9 - index / 100, 106.9)
        ),
        // A quiet cell in the Gobi: a single charger.
        charger("quiet-1", 43.5, 100.5),
      ],
      Date.now()
    );

    const jobs = await listJobs(env);
    // The cells come in whatever order the grouping answers.
    expect(jobs.toSorted((a, b) => a.area.localeCompare(b.area))).toEqual([
      { source: SOURCE, area: "43,100", priority: 5 },
      { source: SOURCE, area: "47,106", priority: 4 },
      { source: SOURCE, area: "47,19", priority: 3 },
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
      { area: "43,100", priority: 5, cursor: null },
      { area: "47,106", priority: 4, cursor: null },
      { area: "47,19", priority: 3, cursor: "underway" },
    ]);
  });
});

describe("amenities runStep", () => {
  // The query's elements for a toilet at the given place, in the toilets'
  // (the second kind's) section.
  const toiletAt = (lat, lon) => [
    { type: "count" },
    { type: "node", lat, lon },
    { type: "count" },
    { type: "count" },
    { type: "count" },
  ];

  test("looks up a sparse cell in one step, and writes only changed masks", async () => {
    const env = { DB: db() };
    await upsertChargers(env.DB, [charger("1", 47.1, 19.1), charger("2", 47.2, 19.2)], Date.now());
    overpassQueries.length = 0;
    overpassElements = toiletAt(47.1001, 19.1001);

    const result = await runStep(env, { source: SOURCE, area: "47,19", cursor: null });

    expect(result).toEqual({ done: true });
    expect(overpassQueries).toHaveLength(1);
    const masks = await env.DB.prepare(
      "SELECT source_id, amenities FROM chargers ORDER BY source_id"
    ).all();
    expect(masks.results).toEqual([
      { source_id: "1", amenities: 2 },
      { source_id: "2", amenities: 0 },
    ]);
  });

  const busyCell = async () => {
    const env = { DB: db() };
    await upsertChargers(
      env.DB,
      [
        ...Array.from({ length: 100 }, (_, index) =>
          charger(`busy-${index}`, 47 + (index % 10) / 100, 19 + Math.floor(index / 10) / 100)
        ),
        // In the cell's north-east quadrant.
        charger("far", 47.9, 19.9),
      ],
      Date.now()
    );
    overpassQueries.length = 0;
    overpassElements = [];
    overpassRefuses = () => false;
    return env;
  };
  const unchecked = async (env) =>
    (await env.DB.prepare("SELECT COUNT(*) AS count FROM chargers WHERE amenities IS NULL").first())
      .count;
  test("looks up a busy cell's quadrants all at once, in one step", async () => {
    const env = await busyCell();

    const result = await runStep(env, { source: SOURCE, area: "47,19", cursor: null });

    expect(result).toEqual({ done: true, cursor: null });
    // Four queries, one per quadrant, none for the whole cell.
    expect(overpassQueries).toHaveLength(4);
    for (const query of overpassQueries) {
      expect(query).not.toContain("46.99865,18.99799,48.00135,20.00201");
    }
    expect(await unchecked(env)).toBe(0);
  });

  test("keeps the quadrants that failed for the next step, and fails only when none worked", async () => {
    const env = await busyCell();
    // The north-east quadrant's mirror is overloaded.
    overpassRefuses = (query) => query.includes("(47.49865,19.49");

    const first = await runStep(env, { source: SOURCE, area: "47,19", cursor: null });
    expect(first).toEqual({ done: false, cursor: "0,1,2" });
    expect(await unchecked(env)).toBe(1);

    // Next time, only that one is asked for.
    overpassQueries.length = 0;
    await expect(runStep(env, { source: SOURCE, area: "47,19", cursor: "0,1,2" })).rejects.toThrow(
      "Overpass failed"
    );
    expect(overpassQueries).toHaveLength(1);
    overpassRefuses = () => false;
    const second = await runStep(env, { source: SOURCE, area: "47,19", cursor: "0,1,2" });
    expect(second).toEqual({ done: true, cursor: null });
    expect(await unchecked(env)).toBe(0);
  });
});

describe("doneQuadrants", () => {
  test("reads the quadrants done, also from a cursor of the one-at-a-time steps", () => {
    expect([...doneQuadrants(null)]).toEqual([]);
    expect([...doneQuadrants("0,2")]).toEqual([0, 2]);
    expect([...doneQuadrants("2")]).toEqual([0, 1]);
    expect([...doneQuadrants("2.0")]).toEqual([0, 1]);
    expect([...doneQuadrants(4)]).toEqual([0, 1, 2, 3]);
  });
});
