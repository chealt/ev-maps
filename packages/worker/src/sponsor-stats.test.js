import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import { sponsorStats } from "./sponsor-stats.js";

const NOW = Date.UTC(2026, 10, 23, 12);
const url = (query = "") => new URL(`https://ev.chealt.com/api/admin/sponsors${query}`);

const database = () =>
  testD1(
    "../migrations/0002_auth.sql",
    "../migrations/0012_support_clicks.sql",
    "../migrations/0013_sponsorships.sql"
  );
const clicks = (db, rows) => {
  for (const [day, platform, count] of rows) {
    db.sqlite.query("INSERT INTO support_clicks VALUES (?, ?, ?)").run(day, platform, count);
  }
};
const sponsorships = (db, rows) => {
  for (const [platform, platformId, createdAt, monthly, sponsor] of rows) {
    db.sqlite
      .query(
        `INSERT INTO sponsorships (platform, platform_id, created_at, monthly, sponsor)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(platform, platformId, createdAt, monthly, sponsor);
  }
};
const platform = (stats, id) => stats.platforms.find((entry) => entry.id === id);

describe("sponsorStats", () => {
  test("counts each platform's clicks per day in the period", async () => {
    const db = database();
    clicks(db, [
      ["2026-11-23", "ko-fi", 3],
      ["2026-11-20", "ko-fi", 1],
      ["2026-11-22", "github-sponsors", 2],
      // Before the last 30 days.
      ["2026-10-01", "ko-fi", 5],
    ]);
    const stats = await sponsorStats(db, url("?days=30"), NOW);
    expect(stats.period).toBe(30);
    expect(stats.days).toHaveLength(30);
    expect(stats.days[0]).toBe("2026-10-25");
    expect(stats.days.at(-1)).toBe("2026-11-23");
    expect(platform(stats, "ko-fi")).toMatchObject({
      clicks: 4,
      byDay: { "2026-11-23": 3, "2026-11-20": 1 },
    });
    expect(platform(stats, "github-sponsors").clicks).toBe(2);
    expect(platform(stats, "buycoffee")).toEqual({
      id: "buycoffee",
      clicks: 0,
      byDay: {},
      oneTime: 0,
      monthly: 0,
      sponsors: 0,
      ratio: null,
    });
    expect(stats.totals.clicks).toBe(6);
  });

  test("counts new sponsors once, as their first sponsorship was", async () => {
    const db = database();
    clicks(db, [["2026-11-01", "ko-fi", 10]]);
    sponsorships(db, [
      // A monthly Ko-fi sponsor: a row per payment, one sponsor.
      ["ko-fi", "k1", "2026-09-10T10:00:00.000Z", 1, "ada@example.com"],
      ["ko-fi", "k2", "2026-10-10T10:00:00.000Z", 1, "ada@example.com"],
      ["ko-fi", "k3", "2026-11-10T10:00:00.000Z", 1, "ada@example.com"],
      // One-time, then monthly: one-time, as the first was.
      ["ko-fi", "k4", "2026-11-02T10:00:00.000Z", 0, "bob@example.com"],
      ["ko-fi", "k5", "2026-11-12T10:00:00.000Z", 1, "bob@example.com"],
      // Started before the period: not new.
      ["ko-fi", "k6", "2025-01-01T10:00:00.000Z", 1, "cyd@example.com"],
      ["ko-fi", "k7", "2026-11-05T10:00:00.000Z", 1, "cyd@example.com"],
      ["github-sponsors", "g1", "2026-11-03T10:00:00.000Z", 1, "grace"],
      ["github-sponsors", "g2", "2026-11-04T10:00:00.000Z", 0, null],
    ]);
    const stats = await sponsorStats(db, url(), NOW);
    expect(stats.period).toBe(90);
    expect(platform(stats, "ko-fi")).toMatchObject({
      oneTime: 1,
      monthly: 1,
      sponsors: 2,
      ratio: 0.2,
    });
    expect(platform(stats, "github-sponsors")).toMatchObject({
      oneTime: 1,
      monthly: 1,
      sponsors: 2,
      ratio: null,
    });
    expect(stats.totals).toEqual({
      clicks: 10,
      oneTime: 2,
      monthly: 2,
      sponsors: 4,
      ratio: 0.4,
    });
  });

  test("takes only the periods it knows", async () => {
    const db = database();
    expect((await sponsorStats(db, url("?days=365"), NOW)).period).toBe(365);
    expect((await sponsorStats(db, url("?days=7"), NOW)).period).toBe(90);
  });
});
