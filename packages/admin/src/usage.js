// Usage stats in the admin database (ADMIN_DB): counts per day of known
// events, each by one dimension. The Worker counts its own (sign-ups,
// sign-ins, routes, favorites); pages send theirs, batched, to
// POST /api/usage. No identifiers are stored; counts are kept ~13 months.

import { isRealRequest } from "./tracing.js";
import { EVERY_15_MINUTES } from "./crons.js";

const USAGE_PATH = "/api/usage";
const KEEP_DAYS = 400;
const MAX_BODY_BYTES = 8 * 1024;
// A page's batch can't claim more than this many of one event.
const MAX_COUNT = 50;
const MAX_DIMENSION_LENGTH = 40;
// The events pages may send, and how their dimension looks.
const PAGE_EVENTS = {
  page_view: /^(en|pl|hu):(home|country|legal)$/,
  // Which page: the site's own (not the admin area), e.g. /hu/hu/.
  page_path: /^\/(en|pl|hu)\/([a-z]{2}\/|privacy\/|terms\/)?$/,
  charger_opened: /^[a-z]{2,10}$/,
  filter_used: /^[a-z-]{2,20}$/,
  locate_me: /^$/,
  list_opened: /^$/,
  sign_in_started: /^[a-z]{2,12}$/,
};

const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

// Adds the counts, [{ event, dimension, count }], to today's.
const countUsage = async (env, counts, now = Date.now()) => {
  // A preview's visitors aren't real users (src/real-traffic.js).
  if (!isRealRequest()) {
    return;
  }
  if (!env.ADMIN_DB || counts.length === 0) {
    return;
  }
  const day = dayOf(now);
  try {
    await env.ADMIN_DB.batch(
      counts.map(({ event, dimension = "", count = 1 }) =>
        env.ADMIN_DB.prepare(
          `INSERT INTO usage_daily (day, event, dimension, count) VALUES (?, ?, ?, ?)
           ON CONFLICT (day, event, dimension) DO UPDATE SET count = count + excluded.count`
        ).bind(day, event, dimension, count)
      )
    );
  } catch (error) {
    // Counting must never break what it counts.
    console.error("Could not count usage:", error);
  }
};

const countEvent = (env, event, dimension = "") => countUsage(env, [{ event, dimension }]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// The page's batch, { events: { [event]: { [dimension]: count } } }, as
// counts; unknown events and dimensions are left out.
const pageCounts = (body) =>
  Object.entries(body?.events ?? {}).flatMap(([event, dimensions]) => {
    const pattern = PAGE_EVENTS[event];
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

// POST /api/usage; with page views, also where the visitors are (the
// country Cloudflare tells from the request, not stored with anything else).
const usageReportResponse = async (request, env) => {
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
  const counts = pageCounts(body);
  const pageViews = counts
    .filter(({ event }) => event === "page_view")
    .reduce((total, { count }) => total + count, 0);
  const country = request.cf?.country;
  if (pageViews && /^[A-Z]{2}$/.test(country ?? "")) {
    counts.push({ event: "visitor_country", dimension: country, count: pageViews });
  }
  await countUsage(env, counts);
  return json({ counted: true }, 202);
};

const deleteOldUsage = async (env, now = Date.now()) => {
  await env.ADMIN_DB?.prepare("DELETE FROM usage_daily WHERE day < ?")
    .bind(dayOf(now - KEEP_DAYS * 24 * 60 * 60 * 1000))
    .run();
};

// Pages sending their usage counts.
const routes = [
  {
    name: "usage",
    // Measuring isn't measured.
    untraced: true,
    limiter: "USAGE_LIMITER",
    signedIn: false,
    matches: (request, url) => url.pathname === USAGE_PATH,
    handle: ({ request, env }) => usageReportResponse(request, env),
  },
];

const jobs = [
  { name: "delete old usage", cron: EVERY_15_MINUTES, run: (env) => deleteOldUsage(env) },
];

export {
  USAGE_PATH,
  countEvent,
  countUsage,
  dayOf,
  deleteOldUsage,
  jobs,
  pageCounts,
  routes,
  usageReportResponse,
};
