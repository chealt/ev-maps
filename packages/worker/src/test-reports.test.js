import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import {
  contentTypeOf,
  deleteOldReports,
  listReports,
  reportFileResponse,
} from "./test-reports.js";

const NOW = Date.UTC(2026, 10, 24, 12);
const ADMIN = { id: "1", email: "grace@chealt.com" };

const adminDb = () => {
  const db = testD1(
    "../admin-migrations/0001_errors.sql",
    "../admin-migrations/0002_usage.sql",
    "../admin-migrations/0003_performance.sql",
    "../admin-migrations/0004_test_reports.sql"
  );
  const insert = db.sqlite.prepare(
    `INSERT INTO test_reports (id, branch, commit_sha, pull_request, run_url, status, passed, failed,
       flaky, skipped, duration_ms, created_at) VALUES (?, 'main', 'abc', NULL, NULL, 'passed', 150, 0, 0, 0, 60000, ?)`
  );
  for (let index = 0; index < 25; index++) {
    insert.run(`${1000 + index}-1`, NOW - index * 60000);
  }
  return db;
};

// An R2 bucket with the given objects (key → text).
const fakeBucket = (objects) => ({
  get: async (key) => (key in objects ? { body: objects[key] } : null),
});

const env = (user) => ({
  ADMIN_EMAIL_DOMAIN: "chealt.com",
  REPORTS: fakeBucket({
    "reports/1234-1/index.html": "<html>report</html>",
    "reports/1234-1/data/abc.zip": "zip",
  }),
  user,
});

const fileAt = (path, user = ADMIN) =>
  reportFileResponse(
    new Request(`https://ev.chealt.com${path}`),
    env(),
    user,
    new URL(`https://ev.chealt.com${path}`)
  );

describe("listReports", () => {
  test("lists the latest first, 20 a page", async () => {
    const first = await listReports(adminDb(), 1);
    expect({ page: first.page, pages: first.pages, total: first.total }).toEqual({
      page: 1,
      pages: 2,
      total: 25,
    });
    expect(first.reports).toHaveLength(20);
    expect(first.reports[0].id).toBe("1000-1");
    expect((await listReports(adminDb(), 2)).reports.map((report) => report.id)).toEqual([
      "1020-1",
      "1021-1",
      "1022-1",
      "1023-1",
      "1024-1",
    ]);
  });

  test("filters by branch, and lists the branches, latest run first", async () => {
    const db = adminDb();
    db.sqlite
      .prepare(
        `INSERT INTO test_reports (id, branch, commit_sha, status, passed, failed, flaky, skipped,
           duration_ms, created_at) VALUES ('2000-1', 'feat/x', 'def', 'failed', 1, 1, 0, 0, 1, ?)`
      )
      .run(NOW + 1000);

    const featureReports = await listReports(db, 1, "feat/x");
    expect(featureReports.reports.map((report) => report.id)).toEqual(["2000-1"]);
    expect(featureReports.total).toBe(1);
    expect(featureReports.branch).toBe("feat/x");
    expect(featureReports.branches).toEqual(["feat/x", "main"]);
    expect((await listReports(db, 1, "main")).total).toBe(25);
    expect((await listReports(db, 1)).total).toBe(26);
  });
});

describe("reportFileResponse", () => {
  test("serves a report's files to admins, with their type", async () => {
    const index = await fileAt("/en/admin/reports/1234-1/");
    expect(index.status).toBe(200);
    expect(await index.text()).toBe("<html>report</html>");
    expect(index.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(index.headers.get("cache-control")).toBe("private, max-age=3600");
    const data = await fileAt("/hu/admin/reports/1234-1/data/abc.zip");
    expect(data.headers.get("content-type")).toBe("application/zip");
  });

  test("is not found for everyone else, or for files that aren't there", async () => {
    expect((await fileAt("/en/admin/reports/1234-1/", null)).status).toBe(404);
    expect(
      (await fileAt("/en/admin/reports/1234-1/", { id: "2", email: "ada@example.com" })).status
    ).toBe(404);
    expect((await fileAt("/en/admin/reports/1234-1/missing.html")).status).toBe(404);
    expect((await fileAt("/en/admin/reports/1234-1/..%2F..%2Fsecret")).status).toBe(404);
  });
});

describe("contentTypeOf", () => {
  test("knows the report's kinds of files", () => {
    expect(contentTypeOf("trace/sw.bundle.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeOf("data/video.webm")).toBe("video/webm");
    expect(contentTypeOf("data/unknown.bin")).toBe("application/octet-stream");
  });
});

describe("deleteOldReports", () => {
  test("keeps 30 days", async () => {
    const db = adminDb();
    db.sqlite
      .prepare("UPDATE test_reports SET created_at = ? WHERE id = '1024-1'")
      .run(NOW - 31 * 86400000);
    await deleteOldReports({ ADMIN_DB: db }, NOW);
    expect((await listReports(db, 1)).total).toBe(24);
  });
});
