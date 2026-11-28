import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { testD1 } from "../test-d1.js";
import { runImport } from "./index.js";

const importDb = () => {
  const db = testD1("../migrations/0001_chargers.sql");
  return { ...db, batch: async (statements) => Promise.all(statements.map((s) => s.all())) };
};

// The runner's clock is faked: a step moves it on by `stepMs` instead of
// waiting, so a 400 ms budget runs in a few milliseconds, always the same.
const START = Date.UTC(2026, 10, 24, 12);
let now;
beforeEach(() => {
  now = START;
  setSystemTime(new Date(now));
});
afterEach(() => {
  setSystemTime();
});

// A source whose jobs take `stepMs` a step, finishing in `steps` steps, and
// which records the areas it worked on.
const source = (name, { areas, priority, stepMs, steps = 1 }) => {
  const worked = [];
  return {
    worked,
    SOURCE: name,
    listJobs: async () => areas.map((area) => ({ source: name, area, priority })),
    runStep: async (env, job) => {
      worked.push(job.area);
      now += stepMs;
      setSystemTime(new Date(now));
      // The job table keeps the cursor as text.
      const step = Number(job.cursor ?? 0) + 1;
      return step >= steps ? { done: true } : { done: false, cursor: step };
    },
  };
};

describe("runImport", () => {
  test("gives the places next to chargers a share of each run, though charger jobs are due", async () => {
    // The chargers' import always has more due than a run can do (many
    // steps each); the places come after it by priority.
    const chargers = source("chargers", {
      areas: ["DE", "FR"],
      priority: 1,
      stepMs: 20,
      steps: 1000,
    });
    const amenities = source("amenities", { areas: ["40,-74", "51,0"], priority: 3, stepMs: 20 });
    const env = { DB: importDb() };

    await runImport(env, { budgetMs: 400, sources: { chargers, amenities }, pauseMs: 0 });

    // The places take 40 ms; the chargers' import the other 360 ms.
    expect(amenities.worked).toEqual(["40,-74", "51,0"]);
    expect(chargers.worked).toHaveLength(18);
  });

  test("gives the rest of the run to the other jobs when the places are done", async () => {
    const chargers = source("chargers", { areas: ["DE"], priority: 1, stepMs: 10, steps: 1000 });
    const amenities = source("amenities", { areas: [], priority: 3, stepMs: 10 });
    const env = { DB: importDb() };

    await runImport(env, { budgetMs: 300, sources: { chargers, amenities }, pauseMs: 0 });

    // Most of the budget, not just its 75%.
    expect(chargers.worked).toHaveLength(30);
    expect(Date.now() - START).toBe(300);
  });

  test("keeps the places to their share while charger jobs are due", async () => {
    // More places than their share holds.
    const areas = Array.from({ length: 50 }, (_, index) => `${index},0`);
    const chargers = source("chargers", { areas: ["DE"], priority: 1, stepMs: 20, steps: 1000 });
    const amenities = source("amenities", { areas, priority: 3, stepMs: 20 });
    const env = { DB: importDb() };

    await runImport(env, { budgetMs: 400, sources: { chargers, amenities }, pauseMs: 0 });

    // 60% of 400 ms of 20 ms steps: 12; the chargers' import gets the rest.
    expect(amenities.worked).toHaveLength(12);
    expect(chargers.worked).toHaveLength(8);
  });
});
