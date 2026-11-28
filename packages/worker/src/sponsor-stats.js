// The admin area's sponsor stats (#435): how often each support link was
// clicked (support_clicks, src/support-clicks.js), how many new sponsors each
// platform had (sponsorships, src/sponsorships.js), and the two's ratio.
//
// - GET /api/admin/sponsors?days=: { period, days, platforms, totals }
//   (admin). `days` are the period's UTC days, oldest first; each platform
//   is { id, clicks, byDay: { day: clicks }, oneTime, monthly, sponsors,
//   ratio }, ratio being new sponsors per click (null without clicks).
//
// A new sponsor is one whose first sponsorship on the platform is in the
// period: Ko-fi stores a row per payment, so a monthly Ko-fi sponsor counts
// once, in the month of the first payment. One-time or monthly is as that
// first sponsorship was.

import { PLATFORMS } from "./support-clicks.js";

const SPONSORS_PATH = "/api/admin/sponsors";
const PERIODS = [30, 90, 365];
const DEFAULT_PERIOD = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });

const periodOf = (url) => {
  const days = Number(url.searchParams.get("days"));
  return PERIODS.includes(days) ? days : DEFAULT_PERIOD;
};

// The period's UTC days, "YYYY-MM-DD", oldest first, ending today.
const daysOf = (period, now) =>
  Array.from({ length: period }, (_, index) =>
    new Date(now - (period - 1 - index) * DAY_MS).toISOString().slice(0, 10)
  );

const sponsorStats = async (db, url, now = Date.now()) => {
  const period = periodOf(url);
  const days = daysOf(period, now);
  const [{ results: clicks }, { results: sponsors }] = await Promise.all([
    db
      .prepare(`SELECT day, platform, count FROM support_clicks WHERE day >= ?`)
      .bind(days[0])
      .all(),
    // SQLite takes the bare `monthly` from the row of MIN(created_at): the
    // sponsor's first sponsorship on the platform.
    db
      .prepare(
        `SELECT platform, monthly, COUNT(*) AS count FROM (
           SELECT platform, MIN(created_at) AS first, monthly FROM sponsorships
           GROUP BY platform, COALESCE(sponsor, platform_id)
         ) WHERE first >= ? GROUP BY platform, monthly`
      )
      .bind(`${days[0]}T00:00:00.000Z`)
      .all(),
  ]);
  const platforms = [...PLATFORMS].map((id) => {
    const byDay = Object.fromEntries(
      clicks.filter(({ platform }) => platform === id).map(({ day, count }) => [day, count])
    );
    const clickCount = Object.values(byDay).reduce((sum, count) => sum + count, 0);
    const counted = (monthly) =>
      sponsors.find((row) => row.platform === id && Boolean(row.monthly) === monthly)?.count ?? 0;
    const oneTime = counted(false);
    const monthly = counted(true);
    return {
      id,
      clicks: clickCount,
      byDay,
      oneTime,
      monthly,
      sponsors: oneTime + monthly,
      ratio: clickCount > 0 ? (oneTime + monthly) / clickCount : null,
    };
  });
  const sum = (key) => platforms.reduce((total, platform) => total + platform[key], 0);
  const totals = { clicks: sum("clicks"), oneTime: sum("oneTime"), monthly: sum("monthly") };
  totals.sponsors = totals.oneTime + totals.monthly;
  totals.ratio = totals.clicks > 0 ? totals.sponsors / totals.clicks : null;
  return { period, days, platforms, totals };
};

const routes = [
  {
    name: "admin-sponsors",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => url.pathname === SPONSORS_PATH,
    handle: async ({ request, env, url }) =>
      request.method === "GET"
        ? json(await sponsorStats(env.DB, url))
        : json({ error: "Method not allowed" }, 405),
  },
];

export { PERIODS, routes, sponsorStats };
