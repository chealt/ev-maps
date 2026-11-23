// POST /api/telemetry: what the pages measure (src/lib/performance.js in the
// app): client spans of their API calls, OpenTelemetry style, in the same
// traces as the Worker's (src/tracing.js), and Core Web Vitals. Kept 14 days
// in the admin database; no user IDs, no IP addresses.

import { isRealTraffic } from "./real-traffic.js";
import { EVERY_15_MINUTES } from "./crons.js";
import { INSERT_SPAN } from "./tracing.js";

const TELEMETRY_PATH = "/api/telemetry";
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_SPANS = 50;
const MAX_VITALS = 20;
const MAX_DURATION_MS = 10 * 60 * 1000;
const VITALS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);
const PAGE_KINDS = new Set(["home", "country", "legal"]);
// The attributes a page's span may carry (OpenTelemetry's names).
const SPAN_ATTRIBUTES = {
  "http.request.method": (value) => /^[A-Z]{3,7}$/.test(value),
  "url.path": (value) =>
    typeof value === "string" && value.startsWith("/api/") && value.length <= 200,
  "http.response.status_code": (value) => Number.isInteger(value) && value >= 0 && value < 600,
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const isFiniteBetween = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

// A page's span as the row to store, or null if it isn't one.
const validSpan = (span, now) => {
  if (
    !/^[0-9a-f]{32}$/.test(span?.traceId ?? "") ||
    !/^[0-9a-f]{16}$/.test(span.spanId ?? "") ||
    typeof span.name !== "string" ||
    span.name.length > 100 ||
    !isFiniteBetween(span.start, now - KEEP_MS, now + 60000) ||
    !isFiniteBetween(span.duration, 0, MAX_DURATION_MS) ||
    !["ok", "error"].includes(span.status)
  ) {
    return null;
  }
  const attributes = Object.fromEntries(
    Object.entries(span.attributes ?? {}).filter(([key, value]) => SPAN_ATTRIBUTES[key]?.(value))
  );
  return [
    span.traceId,
    span.spanId,
    null,
    span.name,
    "client",
    "page",
    span.start,
    span.duration,
    span.status,
    JSON.stringify(attributes),
    now,
  ];
};

const validVital = (vital, now) =>
  VITALS.has(vital?.name) &&
  isFiniteBetween(vital.value, 0, MAX_DURATION_MS) &&
  RATINGS.has(vital.rating) &&
  PAGE_KINDS.has(vital.pageKind)
    ? [vital.name, vital.value, vital.rating, vital.pageKind, now]
    : null;

const telemetryResponse = async (request, env, now = Date.now()) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  // A preview's visitors aren't real users: accepted, not recorded.
  if (!isRealTraffic(request, env)) {
    return json({ spans: 0, vitals: 0 }, 202);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  const spans = (Array.isArray(body?.spans) ? body.spans : [])
    .slice(0, MAX_SPANS)
    .map((span) => validSpan(span, now))
    .filter(Boolean);
  const vitals = (Array.isArray(body?.vitals) ? body.vitals : [])
    .slice(0, MAX_VITALS)
    .map((vital) => validVital(vital, now))
    .filter(Boolean);
  if (env.ADMIN_DB && (spans.length || vitals.length)) {
    try {
      await env.ADMIN_DB.batch([
        ...spans.map((row) => env.ADMIN_DB.prepare(INSERT_SPAN).bind(...row)),
        ...vitals.map((row) =>
          env.ADMIN_DB.prepare(
            "INSERT INTO web_vitals (name, value, rating, page_kind, created_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(...row)
        ),
      ]);
    } catch (error) {
      console.error("Could not record the telemetry:", error);
    }
  }
  return json({ spans: spans.length, vitals: vitals.length }, 202);
};

const deleteOldTelemetry = async (env, now = Date.now()) => {
  if (!env.ADMIN_DB) {
    return;
  }
  await env.ADMIN_DB.batch([
    env.ADMIN_DB.prepare("DELETE FROM spans WHERE created_at < ?").bind(now - KEEP_MS),
    env.ADMIN_DB.prepare("DELETE FROM web_vitals WHERE created_at < ?").bind(now - KEEP_MS),
  ]);
};

const routes = [
  {
    name: "telemetry",
    // Measuring isn't measured.
    untraced: true,
    limiter: "TELEMETRY_LIMITER",
    signedIn: false,
    matches: (request, url) => url.pathname === TELEMETRY_PATH,
    handle: ({ request, env }) => telemetryResponse(request, env),
  },
];

const jobs = [
  { name: "delete old telemetry", cron: EVERY_15_MINUTES, run: (env) => deleteOldTelemetry(env) },
];

export { deleteOldTelemetry, jobs, routes, telemetryResponse };
