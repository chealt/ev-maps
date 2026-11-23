import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import { deleteOldTelemetry, telemetryResponse } from "@ev-maps/admin/telemetry.js";

const adminDb = () => {
  const db = testD1(
    "../../admin/migrations/admin-migrations/0001_errors.sql",
    "../../admin/migrations/admin-migrations/0002_usage.sql",
    "../../admin/migrations/admin-migrations/0003_performance.sql"
  );
  return { ...db, batch: (statements) => Promise.all(statements.map((s) => s.run())) };
};

const NOW = Date.UTC(2026, 10, 23, 12);
const post = (body) =>
  new Request("https://ev.chealt.com/api/telemetry", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const span = (overrides = {}) => ({
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "GET /api/chargers/{z}/{x}/{y}",
  start: NOW - 500,
  duration: 120.5,
  status: "ok",
  attributes: { "http.request.method": "GET", "url.path": "/api/chargers/12/1/2", secret: "x" },
  ...overrides,
});

describe("telemetryResponse", () => {
  test("records nothing from a pull request's preview", async () => {
    const env = { ADMIN_DB: adminDb(), PRODUCTION_HOSTS: "ev.chealt.com" };
    const response = await telemetryResponse(
      new Request("https://my-branch-ev-maps.chealt.workers.dev/api/telemetry", {
        method: "POST",
        body: JSON.stringify({
          spans: [span()],
          vitals: [{ name: "LCP", value: 1800, rating: "good", pageKind: "home" }],
        }),
      }),
      env,
      NOW
    );
    expect(response.status).toBe(202);
    expect(env.ADMIN_DB.sqlite.query("SELECT COUNT(*) AS n FROM spans").get().n).toBe(0);
    expect(env.ADMIN_DB.sqlite.query("SELECT COUNT(*) AS n FROM web_vitals").get().n).toBe(0);
  });

  test("stores the page's spans and Web Vitals", async () => {
    const env = { ADMIN_DB: adminDb() };
    const response = await telemetryResponse(
      post({
        spans: [span()],
        vitals: [{ name: "LCP", value: 1800, rating: "good", pageKind: "country" }],
      }),
      env,
      NOW
    );
    expect(await response.json()).toEqual({ spans: 1, vitals: 1 });
    const [stored] = env.ADMIN_DB.sqlite.query("SELECT * FROM spans").all();
    expect(stored).toMatchObject({
      kind: "client",
      service: "page",
      duration: 120.5,
      parent_span_id: null,
    });
    // Only known attributes are kept.
    expect(JSON.parse(stored.attributes)).toEqual({
      "http.request.method": "GET",
      "url.path": "/api/chargers/12/1/2",
    });
    expect(
      env.ADMIN_DB.sqlite.query("SELECT name, value, rating, page_kind FROM web_vitals").all()
    ).toEqual([{ name: "LCP", value: 1800, rating: "good", page_kind: "country" }]);
  });

  test("leaves out what isn't valid", async () => {
    const env = { ADMIN_DB: adminDb() };
    const response = await telemetryResponse(
      post({
        spans: [span({ traceId: "nope" }), span({ duration: -1 }), span({ start: 0 })],
        vitals: [
          { name: "XYZ", value: 1, rating: "good", pageKind: "home" },
          { name: "CLS", value: 0.1, rating: "great", pageKind: "home" },
          { name: "INP", value: 80, rating: "good", pageKind: "admin" },
        ],
      }),
      env,
      NOW
    );
    expect(await response.json()).toEqual({ spans: 0, vitals: 0 });
    expect((await telemetryResponse(post("nope"), env, NOW)).status).toBe(400);
    expect((await telemetryResponse(post("x".repeat(40000)), env, NOW)).status).toBe(413);
  });
});

describe("deleteOldTelemetry", () => {
  test("keeps 14 days", async () => {
    const env = { ADMIN_DB: adminDb() };
    await telemetryResponse(
      post({ vitals: [{ name: "FCP", value: 900, rating: "good", pageKind: "home" }] }),
      env,
      NOW - 15 * 86400000
    );
    await telemetryResponse(
      post({ vitals: [{ name: "FCP", value: 700, rating: "good", pageKind: "home" }] }),
      env,
      NOW
    );
    await deleteOldTelemetry(env, NOW);
    expect(env.ADMIN_DB.sqlite.query("SELECT value FROM web_vitals").all()).toEqual([
      { value: 700 },
    ]);
  });
});
