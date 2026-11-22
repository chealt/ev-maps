import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import {
  finishTrace,
  operationOf,
  parseTraceparent,
  startTrace,
  traceD1,
  withTrace,
} from "./tracing.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";

// The admin database, with D1's batch().
const adminDb = () => {
  const db = testD1(
    "../admin-migrations/0001_errors.sql",
    "../admin-migrations/0002_usage.sql",
    "../admin-migrations/0003_performance.sql"
  );
  return { ...db, batch: (statements) => Promise.all(statements.map((s) => s.run())) };
};

// An app database with one table, traced.
const appDb = () => {
  const db = testD1();
  db.sqlite.exec("CREATE TABLE chargers (rid INTEGER PRIMARY KEY, name TEXT)");
  db.sqlite.exec("INSERT INTO chargers (name) VALUES ('Downtown'), ('Mall')");
  return traceD1(
    { ...db, batch: (statements) => Promise.all(statements.map((s) => s.all())) },
    "DB"
  );
};

const request = (headers = {}) =>
  new Request("https://ev.chealt.com/api/chargers/status", { headers });

const spans = (db) =>
  db.sqlite
    .query(
      "SELECT trace_id, parent_span_id, name, kind, service, status, attributes FROM spans ORDER BY id"
    )
    .all()
    .map((row) => ({ ...row, attributes: JSON.parse(row.attributes) }));

describe("parseTraceparent", () => {
  test("reads W3C trace context", () => {
    expect(parseTraceparent(`00-${TRACE_ID}-${PARENT_ID}-01`)).toEqual({
      traceId: TRACE_ID,
      parentSpanId: PARENT_ID,
      sampled: true,
    });
    expect(parseTraceparent(`00-${TRACE_ID}-${PARENT_ID}-00`).sampled).toBe(false);
  });

  test("ignores what isn't one", () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent("garbage")).toBeNull();
    expect(parseTraceparent(`00-${"0".repeat(32)}-${PARENT_ID}-01`)).toBeNull();
  });
});

describe("startTrace", () => {
  test("continues the page's trace, with its sampling", () => {
    const trace = startTrace(request({ traceparent: `00-${TRACE_ID}-${PARENT_ID}-01` }), {});
    expect(trace).toMatchObject({ traceId: TRACE_ID, parentSpanId: PARENT_ID, sampled: true });
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  test("starts one otherwise, sampled at the configured rate", () => {
    expect(startTrace(request(), { TRACE_SAMPLE_RATE: "1" }).sampled).toBe(true);
    expect(startTrace(request(), { TRACE_SAMPLE_RATE: "0" }).sampled).toBe(false);
    expect(startTrace(request(), {}).traceId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("operationOf", () => {
  test("names a query by its operation and table", () => {
    expect(operationOf("SELECT * FROM chargers WHERE rid > ?")).toBe("SELECT chargers");
    expect(operationOf('INSERT INTO "favorites" (user_id) VALUES (?)')).toBe("INSERT favorites");
    expect(operationOf("UPDATE chargers SET amenities = ?")).toBe("UPDATE chargers");
  });
});

describe("tracing a request", () => {
  test("records the request and its queries as one trace, under the page's span", async () => {
    const env = { ADMIN_DB: adminDb() };
    const db = appDb();
    const trace = startTrace(request({ traceparent: `00-${TRACE_ID}-${PARENT_ID}-01` }), env);
    trace.route = "status";

    await withTrace(trace, async () => {
      const rows = await db.prepare("SELECT name FROM chargers WHERE rid > ?").bind(0).all();
      expect(rows.results).toHaveLength(2);
      await db.batch([db.prepare("SELECT name FROM chargers").bind()]);
    });
    await finishTrace(env, trace, { request: request(), status: 200 });

    const recorded = spans(env.ADMIN_DB);
    expect(recorded.map(({ name, kind, service }) => [name, kind, service])).toEqual([
      ["GET status", "server", "worker"],
      ["SELECT chargers", "client", "d1"],
      ["BATCH SELECT chargers", "client", "d1"],
    ]);
    expect(recorded.every((span) => span.trace_id === TRACE_ID)).toBe(true);
    expect(recorded[0].parent_span_id).toBe(PARENT_ID);
    expect(recorded[1].parent_span_id).toBe(trace.spanId);
    expect(recorded[0].attributes).toMatchObject({
      "http.request.method": "GET",
      "http.route": "status",
      "url.path": "/api/chargers/status",
      "http.response.status_code": 200,
    });
    expect(recorded[1].attributes).toMatchObject({
      "db.system": "cloudflare-d1",
      "db.operation.name": "SELECT",
      "db.query.text": "SELECT name FROM chargers WHERE rid > ?",
    });
  });

  test("doesn't trace queries outside a request", async () => {
    const db = appDb();
    expect((await db.prepare("SELECT name FROM chargers").first()).name).toBe("Downtown");
  });

  test("keeps unsampled traces only when slow or failed", async () => {
    const env = { ADMIN_DB: adminDb(), TRACE_SAMPLE_RATE: "0" };
    const quick = startTrace(request(), env);
    quick.route = "status";
    await finishTrace(env, quick, { request: request(), status: 200 });
    expect(spans(env.ADMIN_DB)).toHaveLength(0);

    const failed = startTrace(request(), env);
    failed.route = "status";
    await finishTrace(env, failed, { request: request(), status: 500 });
    const slow = startTrace(request(), env);
    slow.route = "status";
    slow.start -= 2000;
    await finishTrace(env, slow, { request: request(), status: 200 });
    expect(spans(env.ADMIN_DB).map((span) => span.status)).toEqual(["error", "ok"]);
  });

  test("records nothing for requests no route handled", async () => {
    const env = { ADMIN_DB: adminDb(), TRACE_SAMPLE_RATE: "1" };
    const trace = startTrace(request(), env);
    await finishTrace(env, trace, { request: request(), status: 200 });
    expect(spans(env.ADMIN_DB)).toHaveLength(0);
  });
});
