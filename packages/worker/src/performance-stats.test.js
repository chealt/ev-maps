import { describe, expect, test } from "bun:test";
import {
  performanceResponse,
  performanceSummary,
  ratingOf,
  vitalsByDay,
} from "./performance-stats.js";
import { testD1 } from "./test-d1.js";
import { INSERT_SPAN } from "./tracing.js";

const NOW = Date.UTC(2026, 10, 24, 12);
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

// The admin database with 20 tile requests (10 … 200 ms, one failed), their
// queries and page spans, one slow trace, and some Web Vitals.
const seeded = () => {
  const db = testD1(
    "../admin-migrations/0001_errors.sql",
    "../admin-migrations/0002_usage.sql",
    "../admin-migrations/0003_performance.sql"
  );
  const span = db.sqlite.prepare(INSERT_SPAN);
  const attrs = (object) => JSON.stringify(object);
  for (let index = 1; index <= 20; index++) {
    const trace = index.toString(16).padStart(32, "0");
    span.run(
      trace,
      `p${index}`.padEnd(16, "0"),
      null,
      "GET /api/chargers/{id}/{id}/{id}",
      "client",
      "page",
      NOW - 1000,
      index * 10 + 5,
      "ok",
      "{}",
      NOW - 1000
    );
    span.run(
      trace,
      `s${index}`.padEnd(16, "0"),
      null,
      "GET tiles",
      "server",
      "worker",
      NOW - 1000,
      index * 10,
      index === 20 ? "error" : "ok",
      attrs({ "url.path": `/api/chargers/12/${index}/1` }),
      NOW - 1000
    );
    span.run(
      trace,
      `d${index}`.padEnd(16, "0"),
      `s${index}`.padEnd(16, "0"),
      "SELECT chargers_rtree",
      "client",
      "d1",
      NOW - 1000,
      index,
      "ok",
      attrs({ "db.query.text": "SELECT * FROM chargers_rtree WHERE ?" }),
      NOW - 1000
    );
  }
  span.run(
    TRACE,
    "a".repeat(16),
    null,
    "POST route",
    "server",
    "worker",
    NOW - 500,
    900,
    "ok",
    attrs({ "url.path": "/api/chargers/route" }),
    NOW - 500
  );
  span.run(
    TRACE,
    "b".repeat(16),
    "a".repeat(16),
    "SELECT chargers_rtree",
    "client",
    "d1",
    NOW - 450,
    700,
    "ok",
    attrs({ "db.query.text": "SELECT * FROM chargers_rtree WHERE ?" }),
    NOW - 500
  );
  // Too old for the last 7 days.
  span.run(
    "f".repeat(32),
    "c".repeat(16),
    null,
    "GET tiles",
    "server",
    "worker",
    NOW,
    99999,
    "ok",
    "{}",
    NOW - 8 * 86400000
  );
  const vital = db.sqlite.prepare(
    "INSERT INTO web_vitals (name, value, rating, page_kind, created_at) VALUES (?, ?, 'good', 'home', ?)"
  );
  for (const value of [1000, 2000, 3000, 5000]) {
    vital.run("LCP", value, NOW - 1000);
  }
  vital.run("CLS", 0.02, NOW - 1000);
  return db;
};

describe("ratingOf", () => {
  test("rates a P75 by Google's thresholds", () => {
    expect(ratingOf("LCP", 2400)).toBe("good");
    expect(ratingOf("LCP", 3000)).toBe("needs-improvement");
    expect(ratingOf("INP", 600)).toBe("poor");
    expect(ratingOf("CLS", 0.1)).toBe("good");
    expect(ratingOf("XYZ", 1)).toBeNull();
  });
});

describe("performanceSummary", () => {
  test("gives P75s, P95s, maxima and errors over the period", async () => {
    const summary = await performanceSummary(seeded(), 7, NOW);
    expect(summary.vitals).toEqual([
      { name: "LCP", count: 4, p75: 3000, rating: "needs-improvement" },
      { name: "CLS", count: 1, p75: 0.02, rating: "good" },
    ]);
    const tiles = summary.requests.find((request) => request.name === "GET tiles");
    // 10, 20 … 200 ms: the 15th of 20 is the P75, the 19th the P95.
    expect(tiles).toMatchObject({ count: 20, p75: 150, p95: 190, max: 200, errors: 1 });
    expect(summary.requests[0].name).toBe("POST route");
    expect(summary.pageRequests[0]).toMatchObject({
      name: "GET /api/chargers/{id}/{id}/{id}",
      count: 20,
      p75: 155,
    });
    expect(summary.queries).toEqual([
      {
        name: "SELECT * FROM chargers_rtree WHERE ?",
        count: 21,
        p75: 16,
        p95: 20,
        max: 700,
        errors: 0,
      },
    ]);
    expect(summary.slowestRequests[0]).toMatchObject({
      trace_id: TRACE,
      name: "POST route",
      duration: 900,
      path: "/api/chargers/route",
    });
    expect(summary.slowestRequests).toHaveLength(20);
  });

  test("answers admins with one trace's spans, in order", async () => {
    const env = { ADMIN_DB: seeded() };
    const response = await performanceResponse(
      new Request(`https://ev.chealt.com/api/admin/performance/traces/${TRACE}`),
      env
    );
    const { spans } = await response.json();
    expect(spans.map((span) => [span.service, span.name])).toEqual([
      ["worker", "POST route"],
      ["d1", "SELECT chargers_rtree"],
    ]);
    expect(spans[1].attributes["db.query.text"]).toBe("SELECT * FROM chargers_rtree WHERE ?");
  });
});

describe("vitalsByDay", () => {
  test("gives each vital's P75 per day over the last 14 days", async () => {
    const db = seeded();
    const vital = db.sqlite.prepare(
      "INSERT INTO web_vitals (name, value, rating, page_kind, created_at) VALUES (?, ?, 'good', 'home', ?)"
    );
    // Three days ago: 1000 and 4000 ms; and one older than the 14 days.
    vital.run("LCP", 1000, NOW - 3 * 86400000);
    vital.run("LCP", 4000, NOW - 3 * 86400000);
    vital.run("LCP", 9999, NOW - 20 * 86400000);

    const { days, vitals } = await vitalsByDay(db, NOW);

    expect(days).toHaveLength(14);
    expect(days.at(-1)).toBe("2026-11-24");
    expect(days[0]).toBe("2026-11-11");
    // Today: 1000, 2000, 3000, 5000 → the 3rd of 4.
    expect(vitals.LCP).toEqual({ "2026-11-21": 4000, "2026-11-24": 3000 });
    expect(vitals.CLS).toEqual({ "2026-11-24": 0.02 });
  });

  test("comes with the summary", async () => {
    const summary = await performanceSummary(seeded(), 1, NOW);
    expect(summary.vitalsByDay.vitals.LCP["2026-11-24"]).toBe(3000);
  });
});
