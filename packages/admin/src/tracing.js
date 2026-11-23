// Traces of the Worker's requests, OpenTelemetry style: a server span for the
// request, a child span for every D1 query it runs, continuing the page's
// trace when it sends a W3C traceparent header (src/lib/performance.js in the
// app). Sampled traces, and every slow or failed request, are written to the
// admin database (spans, admin-migrations/0003_performance.sql).
//
// The current trace is found with AsyncLocalStorage, so the D1 bindings can
// be wrapped once and used by anything (e.g. Better Auth's cached instance).

import { isRealTraffic } from "./real-traffic.js";
import { AsyncLocalStorage } from "node:async_hooks";

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
// Traces the page didn't start are sampled at this rate (TRACE_SAMPLE_RATE).
const DEFAULT_SAMPLE_RATE = 0.2;
// Requests at least this slow are kept even when not sampled.
const SLOW_MS = 1000;
const MAX_QUERY_LENGTH = 500;

const storage = new AsyncLocalStorage();
const currentTrace = () => storage.getStore();

const randomHex = (bytes) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// { traceId, parentSpanId, sampled } from a traceparent header, or null.
const parseTraceparent = (header) => {
  const match = TRACEPARENT.exec(header ?? "");
  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) {
    return null;
  }
  return {
    traceId: match[1],
    parentSpanId: match[2],
    // The sampled flag is the lowest bit.
    sampled: (Number.parseInt(match[3], 16) & 1) === 1,
  };
};

const startTrace = (request, env, random = Math.random) => {
  const parent = parseTraceparent(request.headers.get("traceparent"));
  const rate = Number(env.TRACE_SAMPLE_RATE ?? DEFAULT_SAMPLE_RATE);
  return {
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
    parentSpanId: parent?.parentSpanId ?? null,
    sampled: parent ? parent.sampled : random() < rate,
    start: Date.now(),
    // The route that handled it: requests without one (static files) aren't
    // recorded.
    route: null,
    spans: [],
    // Production's own traffic, not a preview's (src/real-traffic.js).
    realTraffic: isRealTraffic(request, env),
  };
};

// Whether the request being handled is real users' traffic: usage counts
// and traces only count it. Outside a request (jobs), it is.
const isRealRequest = () => currentTrace()?.realTraffic ?? true;

const withTrace = (trace, run) => storage.run(trace, run);

// Names the request's trace by the route that handles it.
const setTraceRoute = (route) => {
  const trace = currentTrace();
  if (trace) {
    trace.route = route;
  }
};

// "SELECT chargers", "INSERT favorites", from the statement.
const operationOf = (sql) => {
  const operation = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "QUERY";
  const table = /\b(?:FROM|INTO|UPDATE|JOIN)\s+"?(\w+)"?/i.exec(sql)?.[1];
  return table ? `${operation} ${table}` : operation;
};

const recordQuery = async (
  trace,
  binding,
  sql,
  run,
  { name = operationOf(sql), batchSize } = {}
) => {
  const start = Date.now();
  let status = "ok";
  try {
    return await run();
  } catch (error) {
    status = "error";
    throw error;
  } finally {
    trace.spans.push({
      spanId: randomHex(8),
      parentSpanId: trace.spanId,
      name,
      kind: "client",
      service: "d1",
      start,
      duration: Date.now() - start,
      status,
      attributes: {
        "db.system": "cloudflare-d1",
        "db.namespace": binding,
        "db.operation.name": sql.trim().split(/\s+/)[0]?.toUpperCase(),
        "db.query.text": sql.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH),
        ...(batchSize ? { "db.operation.batch.size": batchSize } : {}),
      },
    });
  }
};

const QUERY_METHODS = new Set(["all", "first", "run", "raw"]);

// A prepared statement whose queries are spans of the current trace.
const traceStatement = (statement, binding, sql) =>
  new Proxy(statement, {
    get: (target, property) => {
      if (property === "bind") {
        return (...values) => traceStatement(target.bind(...values), binding, sql);
      }
      if (property === "untraced") {
        return target;
      }
      if (property === "sql") {
        return sql;
      }
      const value = Reflect.get(target, property, target);
      if (QUERY_METHODS.has(property)) {
        return (...args) => {
          const trace = currentTrace();
          return trace
            ? recordQuery(trace, binding, sql, () => value.apply(target, args))
            : value.apply(target, args);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

// The D1 binding with its statements and batches traced.
const traceD1 = (db, binding) =>
  new Proxy(db, {
    get: (target, property) => {
      if (property === "prepare") {
        return (sql) => traceStatement(target.prepare(sql), binding, sql);
      }
      if (property === "batch") {
        return (statements) => {
          const unwrapped = statements.map((statement) => statement.untraced ?? statement);
          const trace = currentTrace();
          if (!trace) {
            return target.batch(unwrapped);
          }
          // Named after the operations in it, e.g. "BATCH INSERT chargers".
          const sqls = statements.map((statement) => statement.sql ?? "");
          const operations = [...new Set(sqls.map(operationOf))].join(", ");
          return recordQuery(trace, binding, sqls.join("; "), () => target.batch(unwrapped), {
            name: `BATCH ${operations}`,
            batchSize: statements.length,
          });
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

const tracedEnvs = new WeakMap();

// The env with its app database traced (the admin database, where traces are
// written, isn't).
const tracedEnv = (env) => {
  if (!env.DB) {
    return env;
  }
  if (!tracedEnvs.has(env)) {
    tracedEnvs.set(env, { ...env, DB: traceD1(env.DB, "DB") });
  }
  return tracedEnvs.get(env);
};

const spanRow = (trace, span, now) => [
  trace.traceId,
  span.spanId,
  span.parentSpanId,
  span.name,
  span.kind,
  span.service,
  span.start,
  span.duration,
  span.status,
  JSON.stringify(span.attributes ?? {}),
  now,
];

const INSERT_SPAN = `INSERT INTO spans (trace_id, span_id, parent_span_id, name, kind, service,
  start_time, duration, status, attributes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Adds the request's server span and writes the trace, if it's sampled, slow
// or failed.
const finishTrace = async (env, trace, { request, status }) => {
  if (!trace.route || !env.ADMIN_DB || !trace.realTraffic) {
    return;
  }
  const duration = Date.now() - trace.start;
  const failed = status >= 500;
  if (!trace.sampled && duration < SLOW_MS && !failed) {
    return;
  }
  const url = new URL(request.url);
  const server = {
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
    name: `${request.method} ${trace.route}`,
    kind: "server",
    service: "worker",
    start: trace.start,
    duration,
    status: failed ? "error" : "ok",
    attributes: {
      "http.request.method": request.method,
      "http.route": trace.route,
      "url.path": url.pathname,
      "http.response.status_code": status,
    },
  };
  const now = Date.now();
  try {
    await env.ADMIN_DB.batch(
      [server, ...trace.spans].map((span) =>
        env.ADMIN_DB.prepare(INSERT_SPAN).bind(...spanRow(trace, span, now))
      )
    );
  } catch (error) {
    // Tracing must never break what it traces.
    console.error("Could not record the trace:", error);
  }
};

export {
  INSERT_SPAN,
  finishTrace,
  isRealRequest,
  operationOf,
  parseTraceparent,
  setTraceRoute,
  startTrace,
  traceD1,
  tracedEnv,
  withTrace,
};
