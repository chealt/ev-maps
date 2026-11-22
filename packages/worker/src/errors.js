// Errors from the Worker and the pages, kept in the admin database
// (ADMIN_DB, admin-migrations/) for the admin area, 30 days long.
//
// - The Worker records what it doesn't handle: failing requests and
//   scheduled jobs, and import or status jobs that fail.
// - The pages report theirs to POST /api/errors (public, rate limited).

import { EVERY_15_MINUTES } from "./crons.js";

const ERRORS_PATH = "/api/errors";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const LIMITS = { name: 100, message: 1000, stack: 8000, url: 500, context: 200, userAgent: 300 };
// The same error from one Worker instance is recorded once a minute at most.
const REPEAT_WINDOW_MS = 60 * 1000;
const lastRecorded = new Map();

const clip = (value, max) =>
  typeof value === "string" && value.length ? value.slice(0, max) : null;

// FNV-1a, as hex: short and stable.
const hash = (text) => {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16).padStart(8, "0");
};

// What makes errors "the same": where they come from, their kind, their
// message without numbers (IDs, counts) and their first stack line without
// line and column numbers.
const fingerprintOf = ({ source, name, message, stack }) => {
  const firstFrame = (stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("at ") || line.includes("@"));
  const normalize = (text) => (text ?? "").replace(/\d+/g, "?");
  return hash([source, name ?? "", normalize(message), normalize(firstFrame)].join("|"));
};

const recordError = async (env, error) => {
  if (!env.ADMIN_DB) {
    return;
  }
  const record = {
    source: error.source,
    name: clip(error.name, LIMITS.name),
    message: clip(error.message, LIMITS.message) ?? "(no message)",
    stack: clip(error.stack, LIMITS.stack),
    url: clip(error.url, LIMITS.url),
    method: clip(error.method, 10),
    context: clip(error.context, LIMITS.context),
    userAgent: clip(error.userAgent, LIMITS.userAgent),
    userId: clip(error.userId, 100),
    country: clip(error.country, 2),
  };
  const fingerprint = fingerprintOf(record);
  const now = Date.now();
  if (record.source === "worker" && now - (lastRecorded.get(fingerprint) ?? 0) < REPEAT_WINDOW_MS) {
    return;
  }
  lastRecorded.set(fingerprint, now);
  try {
    await env.ADMIN_DB.prepare(
      `INSERT INTO errors (fingerprint, source, name, message, stack, url, method, context,
         user_agent, user_id, country, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fingerprint,
        record.source,
        record.name,
        record.message,
        record.stack,
        record.url,
        record.method,
        record.context,
        record.userAgent,
        record.userId,
        record.country,
        now
      )
      .run();
  } catch (failure) {
    // Recording must never break what it records.
    console.error("Could not record the error:", failure);
  }
};

// An error the Worker caught, e.g. while serving a request or running a job.
const recordWorkerError = (env, error, { request, context } = {}) =>
  recordError(env, {
    source: "worker",
    name: error?.name,
    message: error?.message ?? String(error),
    stack: error?.stack,
    url: request?.url,
    method: request?.method,
    context,
    userAgent: request?.headers.get("user-agent"),
    country: request?.cf?.country,
  });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// POST /api/errors: { name, message, stack, url } from a page.
const errorReportResponse = async (request, env, userId) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let report;
  try {
    report = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  if (typeof report?.message !== "string" || !report.message) {
    return json({ error: "Invalid error report" }, 400);
  }
  await recordError(env, {
    source: "page",
    name: report.name,
    message: report.message,
    stack: report.stack,
    url: report.url,
    userAgent: request.headers.get("user-agent"),
    userId,
    country: request.cf?.country,
  });
  return json({ recorded: true }, 202);
};

const deleteOldErrors = async (env) => {
  await env.ADMIN_DB?.prepare("DELETE FROM errors WHERE created_at < ?")
    .bind(Date.now() - KEEP_MS)
    .run();
};

// Pages reporting their errors; anyone may, and signed in, with who it
// happened to.
const routes = [
  {
    name: "errors",
    limiter: "ERRORS_LIMITER",
    signedIn: false,
    matches: (request, url) => url.pathname === ERRORS_PATH,
    handle: async ({ request, env, signedInUser }) => {
      const reporter = await signedInUser().catch(() => null);
      return errorReportResponse(request, env, reporter?.id ?? null);
    },
  },
];

const jobs = [{ name: "delete old errors", cron: EVERY_15_MINUTES, run: deleteOldErrors }];

export {
  ERRORS_PATH,
  deleteOldErrors,
  errorReportResponse,
  fingerprintOf,
  jobs,
  recordError,
  recordWorkerError,
  routes,
};
