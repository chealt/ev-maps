import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { startTrace, withTrace } from "@ev-maps/admin/tracing.js";
import { countUsage, deleteOldUsage } from "@ev-maps/admin/usage.js";
import { usage } from "./admin-area.js";

const countEvent = usage.countEvent;
const pageCountsOf = usage.pageCounts;
const report = usage.usageReportResponse;
import { testD1 } from "./test-d1.js";

// testD1 with D1's batch().
const adminDb = () => {
  const db = testD1(
    "../../admin/migrations/admin-migrations/0001_errors.sql",
    "../../admin/migrations/admin-migrations/0002_usage.sql"
  );
  return { ...db, batch: async (statements) => Promise.all(statements.map((s) => s.run())) };
};

const rows = (db) =>
  db.sqlite
    .query("SELECT day, event, dimension, count FROM usage_daily ORDER BY event, dimension")
    .all();

describe("pageCounts", () => {
  test("takes the known events with valid dimensions, capping counts", () => {
    expect(
      pageCountsOf({
        events: {
          page_view: { "en:home": 2, "hu:country": 1, "xx:home": 1, "en:admin": 1 },
          page_path: { "/hu/hu/": 1, "/en/privacy/": 1, "/en/admin/": 1, "/x": 1 },
          locate_me: { "": 3 },
          filter_used: { "connector-type": 500 },
          evil_event: { "": 1 },
          charger_opened: { ocm: 1.5, eipa: -1, irve: 1 },
        },
      })
    ).toEqual([
      { event: "page_view", dimension: "en:home", count: 2 },
      { event: "page_view", dimension: "hu:country", count: 1 },
      { event: "page_path", dimension: "/hu/hu/", count: 1 },
      { event: "page_path", dimension: "/en/privacy/", count: 1 },
      { event: "locate_me", dimension: "", count: 3 },
      { event: "filter_used", dimension: "connector-type", count: 50 },
      { event: "charger_opened", dimension: "irve", count: 1 },
    ]);
    expect(pageCountsOf(null)).toEqual([]);
    expect(pageCountsOf({ events: { page_view: "lots" } })).toEqual([]);
  });
});

describe("countUsage", () => {
  test("adds to the day's counts", async () => {
    const env = { ADMIN_DB: adminDb() };
    const now = Date.UTC(2026, 10, 23, 12);
    await countUsage(
      env.ADMIN_DB,
      [{ event: "sign_in" }, { event: "page_view", dimension: "en:home", count: 2 }],
      now
    );
    await countUsage(env.ADMIN_DB, [{ event: "page_view", dimension: "en:home", count: 3 }], now);
    await countUsage(env.ADMIN_DB, [{ event: "sign_in" }], Date.UTC(2026, 10, 24, 1));
    expect(rows(env.ADMIN_DB)).toEqual([
      { day: "2026-11-23", event: "page_view", dimension: "en:home", count: 5 },
      { day: "2026-11-23", event: "sign_in", dimension: "", count: 1 },
      { day: "2026-11-24", event: "sign_in", dimension: "", count: 1 },
    ]);
  });

  test("does nothing without the admin database or counts", async () => {
    await countUsage(null, [{ event: "sign_in" }]);
    await countUsage(adminDb(), []);
  });
});

describe("usageReportResponse", () => {
  const post = (body) =>
    new Request("https://ev.chealt.com/api/usage", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  afterEach(() => {
    setSystemTime();
  });

  test("counts a page's batch", async () => {
    // Just before midnight: the count is for the day it came in.
    setSystemTime(new Date(Date.UTC(2026, 10, 23, 23, 59, 59, 999)));
    const env = { ADMIN_DB: adminDb() };
    const response = await report(post({ events: { list_opened: { "": 2 } } }), env);
    expect(response.status).toBe(202);
    expect(rows(env.ADMIN_DB)).toEqual([
      { day: "2026-11-23", event: "list_opened", dimension: "", count: 2 },
    ]);
  });

  test("counts the visitors' country with their page views", async () => {
    const env = { ADMIN_DB: adminDb() };
    const request = post({
      events: { page_view: { "hu:country": 2 }, visitor_country: { US: 9 } },
    });
    Object.defineProperty(request, "cf", { value: { country: "HU" } });
    await report(request, env);
    expect(
      rows(env.ADMIN_DB).map(({ event, dimension, count }) => [event, dimension, count])
    ).toEqual([
      ["page_view", "hu:country", 2],
      ["visitor_country", "HU", 2],
    ]);
  });

  test("refuses what isn't a batch", async () => {
    const env = { ADMIN_DB: adminDb() };
    expect((await report(post("nope"), env)).status).toBe(400);
    expect((await report(post("x".repeat(9000)), env)).status).toBe(413);
    expect((await report(new Request("https://ev.chealt.com/api/usage"), env)).status).toBe(405);
    expect(rows(env.ADMIN_DB)).toEqual([]);
  });
});

describe("deleteOldUsage", () => {
  test("keeps about 13 months", async () => {
    const env = { ADMIN_DB: adminDb() };
    const now = Date.UTC(2026, 10, 23);
    await countUsage(env.ADMIN_DB, [{ event: "sign_in" }], Date.UTC(2025, 9, 1));
    await countUsage(env.ADMIN_DB, [{ event: "sign_up" }], Date.UTC(2025, 11, 1));
    await deleteOldUsage(env.ADMIN_DB, 400, now);
    expect(rows(env.ADMIN_DB).map((row) => row.event)).toEqual(["sign_up"]);
  });
});

describe("preview traffic", () => {
  const env = () => ({ ADMIN_DB: adminDb(), PRODUCTION_HOSTS: "ev.chealt.com" });
  const total = (db) =>
    db.sqlite.query("SELECT COALESCE(SUM(count), 0) AS n FROM usage_daily").get().n;
  const within = (url, environment, run) =>
    withTrace(startTrace(new Request(url), environment), run);

  test("counts production's requests, and a preview's not at all", async () => {
    const environment = env();
    await within("https://ev.chealt.com/api/favorites", environment, () =>
      countEvent(environment, "favorite_added")
    );
    expect(total(environment.ADMIN_DB)).toBe(1);

    await within("https://my-branch-ev-maps.chealt.workers.dev/api/favorites", environment, () =>
      countEvent(environment, "favorite_added")
    );
    const preview = new Request("https://my-branch-ev-maps.chealt.workers.dev/api/usage", {
      method: "POST",
      body: JSON.stringify({ events: { page_view: { "en:home": 3 } } }),
    });
    await within(preview.url, environment, () => report(preview, environment));
    expect(total(environment.ADMIN_DB)).toBe(1);
  });
});
