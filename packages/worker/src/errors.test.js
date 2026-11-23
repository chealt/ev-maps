import { describe, expect, test } from "bun:test";
import {
  deleteOldErrors,
  errorReportResponse,
  fingerprintOf,
  recordWorkerError,
} from "@ev-maps/admin/errors.js";

// An ADMIN_DB stand-in recording the statements run and their values.
const fakeDb = () => {
  const runs = [];
  return {
    runs,
    prepare: (sql) => ({
      bind: (...values) => ({
        run: async () => {
          runs.push({ sql, values });
        },
      }),
    }),
  };
};

const report = (body, headers = {}) =>
  new Request("https://ev.chealt.com/api/errors", {
    method: "POST",
    headers: { "user-agent": "Chrome", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("fingerprintOf", () => {
  test("groups the same error, whatever its numbers", () => {
    const one = {
      source: "page",
      name: "TypeError",
      message: "Cannot read charger 123",
      stack: "TypeError: Cannot read charger 123\n    at show (app.js:10:5)",
    };
    const two = {
      ...one,
      message: "Cannot read charger 456",
      stack: "TypeError: Cannot read charger 456\n    at show (app.js:11:7)",
    };
    expect(fingerprintOf(one)).toBe(fingerprintOf(two));
    expect(fingerprintOf({ ...one, source: "worker" })).not.toBe(fingerprintOf(one));
    expect(fingerprintOf({ ...one, stack: "    at hide (app.js:1:1)" })).not.toBe(
      fingerprintOf(one)
    );
  });
});

describe("errorReportResponse", () => {
  test("records a page's error with its browser and user", async () => {
    const env = { ADMIN_DB: fakeDb() };
    const response = await errorReportResponse(
      report(
        {
          name: "Error",
          message: "boom",
          stack: "Error: boom\n at x",
          url: "https://ev.chealt.com/en/",
        },
        { "user-agent": "Firefox" }
      ),
      env,
      "user-1"
    );
    expect(response.status).toBe(202);
    const [{ sql, values }] = env.ADMIN_DB.runs;
    expect(sql).toContain("INSERT INTO errors");
    expect(values.slice(1, 6)).toEqual([
      "page",
      "Error",
      "boom",
      "Error: boom\n at x",
      "https://ev.chealt.com/en/",
    ]);
    expect(values[8]).toBe("Firefox");
    expect(values[9]).toBe("user-1");
  });

  test("clips long values", async () => {
    const env = { ADMIN_DB: fakeDb() };
    await errorReportResponse(report({ message: "x".repeat(5000) }), env, null);
    expect(env.ADMIN_DB.runs[0].values[3]).toHaveLength(1000);
  });

  test("refuses what isn't an error report", async () => {
    const env = { ADMIN_DB: fakeDb() };
    expect((await errorReportResponse(report("nope"), env, null)).status).toBe(400);
    expect((await errorReportResponse(report({ stack: "x" }), env, null)).status).toBe(400);
    expect(
      (await errorReportResponse(report({ message: "x".repeat(20000) }), env, null)).status
    ).toBe(413);
    const get = new Request("https://ev.chealt.com/api/errors");
    expect((await errorReportResponse(get, env, null)).status).toBe(405);
    expect(env.ADMIN_DB.runs).toHaveLength(0);
  });
});

describe("recordWorkerError", () => {
  test("records the Worker's error once a minute", async () => {
    const env = { ADMIN_DB: fakeDb() };
    const error = new Error(`Overpass failed ${Math.random()}`);
    await recordWorkerError(env, error, { context: "import amenities 47,19" });
    await recordWorkerError(env, error, { context: "import amenities 47,19" });
    expect(env.ADMIN_DB.runs).toHaveLength(1);
    expect(env.ADMIN_DB.runs[0].values[1]).toBe("worker");
    expect(env.ADMIN_DB.runs[0].values[7]).toBe("import amenities 47,19");
  });

  test("does nothing without the admin database", async () => {
    await recordWorkerError({}, new Error("nowhere to go"));
  });
});

describe("deleteOldErrors", () => {
  test("deletes errors older than 30 days", async () => {
    const env = { ADMIN_DB: fakeDb() };
    await deleteOldErrors(env);
    const [{ sql, values }] = env.ADMIN_DB.runs;
    expect(sql).toContain("DELETE FROM errors");
    expect(Date.now() - values[0]).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
});
