// Generic usage stats in a D1 database: counts per day of known events, each
// by one dimension. The host counts its own events (countEvent) and pages
// send theirs, batched, to the report endpoint. No identifiers are stored;
// counts are kept for a configurable number of days.
//
// createUsage({ events }) builds the routes and jobs; `events` maps each
// event the pages may send to a RegExp its dimension must match.

import { isRealRequest } from "./tracing.js";
import { EVERY_15_MINUTES } from "./crons.js";

const DEFAULT_KEEP_DAYS = 400;
const MAX_BODY_BYTES = 8 * 1024;
// A page's batch can't claim more than this many of one event.
const MAX_COUNT = 50;
const MAX_DIMENSION_LENGTH = 40;

const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// The page's batch, { events: { [event]: { [dimension]: count } } }, as
// counts; unknown events and dimensions are left out.
const pageCounts = (events, body) =>
  Object.entries(body?.events ?? {}).flatMap(([event, dimensions]) => {
    const pattern = events[event];
    if (!pattern || typeof dimensions !== "object" || dimensions === null) {
      return [];
    }
    return Object.entries(dimensions)
      .filter(
        ([dimension, count]) =>
          dimension.length <= MAX_DIMENSION_LENGTH &&
          pattern.test(dimension) &&
          Number.isInteger(count) &&
          count > 0
      )
      .map(([dimension, count]) => ({ event, dimension, count: Math.min(count, MAX_COUNT) }));
  });

// Adds the counts, [{ event, dimension, count }], to today's. Only real
// users' traffic is counted (tracing.js's isRealRequest).
const countUsage = async (db, counts, now = Date.now()) => {
  if (!isRealRequest() || !db || counts.length === 0) {
    return;
  }
  const day = dayOf(now);
  try {
    await db.batch(
      counts.map(({ event, dimension = "", count = 1 }) =>
        db
          .prepare(
            `INSERT INTO usage_daily (day, event, dimension, count) VALUES (?, ?, ?, ?)
             ON CONFLICT (day, event, dimension) DO UPDATE SET count = count + excluded.count`
          )
          .bind(day, event, dimension, count)
      )
    );
  } catch (error) {
    // Counting must never break what it counts.
    console.error("Could not count usage:", error);
  }
};

const countEvent = (db, event, dimension = "") => countUsage(db, [{ event, dimension }]);

// The report endpoint (POST): the page's batch, plus where the visitors are
// (the country the request's cf tells, not stored with anything else).
const usageReportResponse = async (events, request, db) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  const counts = pageCounts(events, body);
  const pageViews = counts
    .filter(({ event }) => event === "page_view")
    .reduce((total, { count }) => total + count, 0);
  const country = request.cf?.country;
  if (pageViews && /^[A-Z]{2}$/.test(country ?? "")) {
    counts.push({ event: "visitor_country", dimension: country, count: pageViews });
  }
  await countUsage(db, counts);
  return json({ counted: true }, 202);
};

const deleteOldUsage = async (db, keepDays, now = Date.now()) => {
  await db
    ?.prepare("DELETE FROM usage_daily WHERE day < ?")
    .bind(dayOf(now - keepDays * 24 * 60 * 60 * 1000))
    .run();
};

// createUsage({ events, path, db, keepDays }) builds the module's routes and
// jobs; db is (env) => the database binding.
const createUsage = ({
  events,
  path = "/api/usage",
  db = (env) => env.ADMIN_DB,
  keepDays = DEFAULT_KEEP_DAYS,
}) => ({
  countEvent: (env, event, dimension) => countEvent(db(env), event, dimension),
  countUsage: (env, counts, now) => countUsage(db(env), counts, now),
  dayOf,
  jobs: [
    {
      name: "delete old usage",
      cron: EVERY_15_MINUTES,
      run: (env) => deleteOldUsage(db(env), keepDays),
    },
  ],
  pageCounts: (body) => pageCounts(events, body),
  // Pages sending their usage counts.
  routes: [
    {
      name: "usage",
      // Measuring isn't measured.
      untraced: true,
      limiter: "USAGE_LIMITER",
      signedIn: false,
      matches: (request, url) => url.pathname === path,
      handle: ({ request, env }) => usageReportResponse(events, request, db(env)),
    },
  ],
  usageReportResponse: (request, env) => usageReportResponse(events, request, db(env)),
});

export {
  countEvent,
  countUsage,
  createUsage,
  dayOf,
  deleteOldUsage,
  pageCounts,
  usageReportResponse,
};
