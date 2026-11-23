// The admin area's dashboard, on its overview page (admins only): per day,
// for the last 30 days, the errors (src/errors.js keeps them 30 days), the
// page views and the sign-ins (src/usage.js), and the most visited pages.
//
// - GET /api/admin/dashboard

const DASHBOARD_PATH = "/api/admin/dashboard";
const DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_PAGES = 10;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const isoDay = (time) => new Date(time).toISOString().slice(0, 10);

const byDay = (results) => Object.fromEntries(results.map(({ day, count }) => [day, count]));

// { days: ["2026-10-26", …, today], errors, pageViews, signIns, topPages }:
// errors, pageViews and signIns as { day: count }, without the days with
// none; topPages as [{ path, count }], the most visited first.
const dashboard = async (db, now = Date.now()) => {
  const days = Array.from({ length: DAYS }, (_, index) =>
    isoDay(now - (DAYS - 1 - index) * DAY_MS)
  );
  const since = Date.parse(`${days[0]}T00:00:00Z`);
  const usage = (event) =>
    db
      .prepare(
        "SELECT day, SUM(count) AS count FROM usage_daily WHERE event = ? AND day >= ? GROUP BY day"
      )
      .bind(event, days[0])
      .all();
  const [errors, pageViews, signIns, topPages] = await Promise.all([
    db
      .prepare(
        `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
         FROM errors WHERE created_at >= ? GROUP BY day`
      )
      .bind(since)
      .all(),
    usage("page_view"),
    usage("sign_in"),
    db
      .prepare(
        `SELECT dimension AS path, SUM(count) AS count FROM usage_daily
         WHERE event = 'page_path' AND day >= ?
         GROUP BY dimension ORDER BY count DESC, path LIMIT ?`
      )
      .bind(days[0], TOP_PAGES)
      .all(),
  ]);
  return {
    days,
    errors: byDay(errors.results),
    pageViews: byDay(pageViews.results),
    signIns: byDay(signIns.results),
    topPages: topPages.results,
  };
};

const routes = [
  {
    name: "admin-dashboard",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => url.pathname === DASHBOARD_PATH,
    handle: async ({ request, env }) =>
      request.method === "GET"
        ? json(await dashboard(env.ADMIN_DB))
        : json({ error: "Method not allowed" }, 405),
  },
];

export { dashboard, routes };
