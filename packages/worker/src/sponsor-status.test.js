import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import { isSponsor } from "./sponsor-status.js";

const NOW = Date.UTC(2026, 10, 25, 12);
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const environment = (rows) => {
  const db = testD1("../migrations/0002_auth.sql", "../migrations/0013_sponsorships.sql");
  db.sqlite.exec(`INSERT INTO "user" VALUES ('u-ada', 'Ada', 'ada@example.com', 1, NULL, 0, 0);`);
  rows.forEach(
    ({ platform = "ko-fi", createdAt, monthly = 0, status = "active", userId = "u-ada" }, index) =>
      db.sqlite
        .query(
          `INSERT INTO sponsorships (platform, platform_id, created_at, monthly, status, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(platform, `p-${index}`, createdAt, monthly, status, userId)
  );
  return { DB: db };
};

const sponsor = (rows) => isSponsor(environment(rows), "u-ada", NOW);

describe("isSponsor", () => {
  test("not without a sponsorship, or with someone else's", async () => {
    expect(await sponsor([])).toBe(false);
    expect(await sponsor([{ createdAt: daysAgo(1), userId: null }])).toBe(false);
  });

  test("a one-time sponsorship counts for 12 months", async () => {
    expect(await sponsor([{ createdAt: daysAgo(300) }])).toBe(true);
    expect(await sponsor([{ createdAt: daysAgo(400) }])).toBe(false);
  });

  test("an active GitHub monthly sponsorship counts until it's cancelled", async () => {
    const monthly = { platform: "github-sponsors", monthly: 1, createdAt: daysAgo(700) };
    expect(await sponsor([monthly])).toBe(true);
    expect(await sponsor([{ ...monthly, status: "cancelled" }])).toBe(false);
  });

  test("a Ko-fi monthly sponsorship counts while its last payment is recent", async () => {
    expect(await sponsor([{ monthly: 1, createdAt: daysAgo(30) }])).toBe(true);
    expect(await sponsor([{ monthly: 1, createdAt: daysAgo(60) }])).toBe(false);
  });
});
