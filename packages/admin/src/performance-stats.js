// The admin area's performance page (admins only): P75s of the Web Vitals,
// the requests (as the Worker and as the page saw them), the slowest
// queries, the slowest requests, and any trace's spans. From the spans and
// web_vitals the pages and the Worker record (src/tracing.js,
// src/telemetry.js).
//
// - GET /api/admin/performance?days=1|7|14
// - GET /api/admin/performance/traces/{traceId}

const SUMMARY_PATH = "/api/admin/performance";
const TRACE_PATH = /^\/api\/admin\/performance\/traces\/([0-9a-f]{32})$/;
const PERIODS = [1, 7, 14];
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP = 20;
// Google's thresholds for a good and a poor P75 (web.dev/articles/vitals).
const VITAL_THRESHOLDS = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const ratingOf = (name, value) => {
  const [good, poor] = VITAL_THRESHOLDS[name] ?? [];
  if (good === undefined || value === null) {
    return null;
  }
  if (value <= good) {
    return "good";
  }
  return value <= poor ? "needs-improvement" : "poor";
};

// Percentiles per group with window functions: the value at rank
// ceil(n × p) of each group, by value. `source` selects `group_key` and
// `value`, filtered by created_at >= ?1.
const percentiles = (source) => `
  WITH ranked AS (
    SELECT group_key, value, extra,
      ROW_NUMBER() OVER (PARTITION BY group_key ORDER BY value) AS rank,
      COUNT(*) OVER (PARTITION BY group_key) AS n
    FROM (${source})
  )
  SELECT group_key, n AS count,
    MAX(CASE WHEN rank = CAST(n * 0.75 + 0.999999 AS INTEGER) THEN value END) AS p75,
    MAX(CASE WHEN rank = CAST(n * 0.95 + 0.999999 AS INTEGER) THEN value END) AS p95,
    MAX(value) AS max,
    SUM(extra) AS errors
  FROM ranked GROUP BY group_key ORDER BY p75 DESC LIMIT ${TOP}`;

// Each Web Vital's P75 per day over the last TREND_DAYS days, for the chart
// of how they change: { days: ["2026-11-10", ...], vitals: { LCP: { day:
// p75 } } }. Days without measurements have none.
const TREND_DAYS = 14;
const isoDay = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

const vitalsByDay = async (db, now = Date.now()) => {
  const days = Array.from({ length: TREND_DAYS }, (_, index) =>
    isoDay(now - (TREND_DAYS - 1 - index) * DAY_MS)
  );
  const { results } = await db
    .prepare(
      `WITH measured AS (
         SELECT name, date(created_at / 1000, 'unixepoch') AS day, value
         FROM web_vitals WHERE created_at >= ?1
       ),
       ranked AS (
         SELECT name, day, value,
           ROW_NUMBER() OVER (PARTITION BY name, day ORDER BY value) AS rank,
           COUNT(*) OVER (PARTITION BY name, day) AS n
         FROM measured
       )
       SELECT name, day, MAX(CASE WHEN rank = CAST(n * 0.75 + 0.999999 AS INTEGER) THEN value END) AS p75
       FROM ranked GROUP BY name, day`
    )
    .bind(Date.parse(`${days[0]}T00:00:00Z`))
    .all();
  const vitals = {};
  for (const { name, day, p75 } of results) {
    vitals[name] ??= {};
    vitals[name][day] = p75;
  }
  return { days, vitals };
};

const performanceSummary = async (db, days, now = Date.now()) => {
  const since = now - days * DAY_MS;
  const query = (sql) => db.prepare(sql).bind(since).all();
  const [vitals, server, page, queries, slowest, trend] = await Promise.all([
    query(
      percentiles(
        "SELECT name AS group_key, value, 0 AS extra FROM web_vitals WHERE created_at >= ?1"
      )
    ),
    query(
      percentiles(`SELECT name AS group_key, duration AS value, status = 'error' AS extra
        FROM spans WHERE service = 'worker' AND kind = 'server' AND created_at >= ?1`)
    ),
    query(
      percentiles(`SELECT name AS group_key, duration AS value, status = 'error' AS extra
        FROM spans WHERE service = 'page' AND created_at >= ?1`)
    ),
    query(
      percentiles(`SELECT json_extract(attributes, '$."db.query.text"') AS group_key,
          duration AS value, status = 'error' AS extra
        FROM spans WHERE service = 'd1' AND created_at >= ?1`)
    ),
    query(`SELECT trace_id, name, duration, status, start_time,
        json_extract(attributes, '$."url.path"') AS path
      FROM spans WHERE service = 'worker' AND kind = 'server' AND created_at >= ?1
      ORDER BY duration DESC LIMIT ${TOP}`),
    vitalsByDay(db, now),
  ]);
  const groups = ({ results }) =>
    results.map(({ group_key: name, ...stats }) => ({ name, ...stats }));
  return {
    days,
    vitals: groups(vitals).map(({ name, count, p75 }) => ({
      name,
      count,
      p75,
      rating: ratingOf(name, p75),
    })),
    requests: groups(server),
    pageRequests: groups(page),
    queries: groups(queries),
    slowestRequests: slowest.results,
    vitalsByDay: trend,
  };
};

// The trace's spans, in the order they started.
const traceSpans = async (db, traceId) => {
  const { results } = await db
    .prepare(
      `SELECT span_id, parent_span_id, name, kind, service, start_time, duration, status, attributes
       FROM spans WHERE trace_id = ? ORDER BY start_time, id`
    )
    .bind(traceId)
    .all();
  return results.map((span) => ({ ...span, attributes: JSON.parse(span.attributes ?? "{}") }));
};

const performanceResponse = async (request, env) => {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  const traceId = url.pathname.match(TRACE_PATH)?.[1];
  if (traceId) {
    return json({ traceId, spans: await traceSpans(env.ADMIN_DB, traceId) });
  }
  const days = Number(url.searchParams.get("days"));
  return json(await performanceSummary(env.ADMIN_DB, PERIODS.includes(days) ? days : 7));
};

// Only Chealt's own people: the guard checks they're admins.
const routes = [
  {
    name: "performance",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => url.pathname === SUMMARY_PATH || TRACE_PATH.test(url.pathname),
    handle: ({ request, env }) => performanceResponse(request, env),
  },
];

export { performanceResponse, performanceSummary, ratingOf, routes, traceSpans, vitalsByDay };
