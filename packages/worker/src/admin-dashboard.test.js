import { describe, expect, test } from "bun:test";
import { dashboard, routes } from "./admin-dashboard.js";
import { testD1 } from "./test-d1.js";

const NOW = Date.UTC(2026, 10, 24, 12);
const HOUR = 60 * 60 * 1000;

const seeded = () => {
  const db = testD1("../admin-migrations/0001_errors.sql", "../admin-migrations/0002_usage.sql");
  const error = db.sqlite.prepare(
    "INSERT INTO errors (fingerprint, source, message, created_at) VALUES ('00000000', 'page', 'x', ?)"
  );
  error.run(NOW);
  error.run(NOW - HOUR);
  error.run(NOW - 24 * HOUR);
  // Older than 30 days: not shown.
  error.run(NOW - 40 * 24 * HOUR);
  const usage = db.sqlite.prepare(
    "INSERT INTO usage_daily (day, event, dimension, count) VALUES (?, ?, ?, ?)"
  );
  usage.run("2026-11-24", "page_view", "en:home", 5);
  usage.run("2026-11-24", "page_view", "hu:country", 2);
  usage.run("2026-11-23", "sign_in", "", 1);
  usage.run("2026-11-24", "list_opened", "", 9);
  return db;
};

describe("dashboard", () => {
  test("counts the errors, page views and sign-ins per day, for 30 days", async () => {
    const stats = await dashboard(seeded(), NOW);
    expect(stats.days).toHaveLength(30);
    expect(stats.days[0]).toBe("2026-10-26");
    expect(stats.days.at(-1)).toBe("2026-11-24");
    expect(stats.errors).toEqual({ "2026-11-23": 1, "2026-11-24": 2 });
    expect(stats.pageViews).toEqual({ "2026-11-24": 7 });
    expect(stats.signIns).toEqual({ "2026-11-23": 1 });
  });

  test("is an admin route on its own path", () => {
    const [route] = routes;
    expect(route.admin).toBe(true);
    expect(route.matches(null, new URL("https://x/api/admin/dashboard"))).toBe(true);
    expect(route.matches(null, new URL("https://x/api/admin/usage"))).toBe(false);
  });
});
