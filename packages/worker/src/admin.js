// The admin area, for Chealt's own people: users whose verified email is at
// ADMIN_EMAIL_DOMAIN (wrangler.toml). Checked here, on the server, for both
// the admin pages (/{lang}/admin/) and the admin API (/api/admin/*).

const ADMIN_PAGE_PATH = /^\/(en|pl|hu)\/admin(\/.*)?$/;
const ADMIN_API_PREFIX = "/api/admin/";
const ADMIN_API_PATH = /^\/api\/admin\/(me|usage|errors(\/[0-9a-f]{8})?)$/;

// `user` is { id, email } of a signed-in user with a verified email, or null.
const isAdmin = (env, user) => {
  const domain = env.ADMIN_EMAIL_DOMAIN?.toLowerCase();
  return Boolean(domain && user?.email?.toLowerCase().endsWith(`@${domain}`));
};

const isAdminPage = (pathname) => ADMIN_PAGE_PATH.test(pathname);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// The admin pages Astro renders on the server, by path (the rest are
// static): each gets its data from here, as the page's props.
const SERVER_RENDERED_PAGES = [
  {
    path: /^\/(en|pl|hu)\/admin\/errors\/$/,
    data: (env, url) => {
      const error = url.searchParams.get("error");
      return /^[0-9a-f]{8}$/.test(error ?? "")
        ? errorOccurrences(env.ADMIN_DB, error, pageOf(url))
        : errorGroups(env.ADMIN_DB, pageOf(url));
    },
  },
];

// A server-rendered page's data; if it can't be read, the page says so.
const pageData = async (page, env, url) => {
  try {
    return { data: await page.data(env, url) };
  } catch (error) {
    console.error("Could not read an admin page's data:", error);
    return { failed: true };
  }
};

// An admin page for admins; for everyone else, as if there were none. Most
// are static; the server-rendered ones go to `render` (Astro's server,
// src/app-server.js) with their data as the context's props.
const adminPageResponse = async (request, env, user, { render, context } = {}) => {
  if (!isAdmin(env, user)) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const url = new URL(request.url);
  const serverPage = SERVER_RENDERED_PAGES.find(({ path }) => path.test(url.pathname));
  const page =
    serverPage && render
      ? await render(request, env, {
          waitUntil: (promise) => context?.waitUntil(promise),
          passThroughOnException: () => context?.passThroughOnException(),
          props: await pageData(serverPage, env, url),
        })
      : await env.ASSETS.fetch(request);
  const headers = new Headers(page.headers);
  // Per user: no shared cache may keep it.
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(page.body, { status: page.status, headers });
};

const ERRORS_PAGE_SIZE = 25;
const USAGE_PERIODS = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (time) => new Date(time).toISOString().slice(0, 10);

// Usage over the last `days` days (today included): per event, the total,
// the count of each day (0 for days without any), and of each dimension,
// largest first.
const usageStats = async (db, days, now = Date.now()) => {
  const dayList = Array.from({ length: days }, (_, index) =>
    isoDay(now - (days - 1 - index) * DAY_MS)
  );
  const { results } = await db
    .prepare("SELECT day, event, dimension, count FROM usage_daily WHERE day >= ? ORDER BY day")
    .bind(dayList[0])
    .all();
  const events = {};
  for (const { day, event, dimension, count } of results) {
    events[event] ??= {
      total: 0,
      byDay: Object.fromEntries(dayList.map((listed) => [listed, 0])),
      byDimension: {},
    };
    const stats = events[event];
    stats.total += count;
    stats.byDay[day] = (stats.byDay[day] ?? 0) + count;
    if (dimension) {
      stats.byDimension[dimension] = (stats.byDimension[dimension] ?? 0) + count;
    }
  }
  for (const stats of Object.values(events)) {
    stats.byDimension = Object.fromEntries(
      Object.entries(stats.byDimension).sort(
        ([nameA, a], [nameB, b]) => b - a || nameA.localeCompare(nameB)
      )
    );
  }
  return { days: dayList, events };
};
const MOST_FAVORITED = 10;

// The chargers most users have as a favorite now (the main database's
// favorites), most first: [{ id, name, users }]. The name is from the copy
// the favorites keep.
const mostFavorited = async (db, limit = MOST_FAVORITED) => {
  const { results } = await db
    .prepare(
      `SELECT charger_id, COUNT(*) AS users, MAX(charger) AS charger FROM favorites
       GROUP BY charger_id ORDER BY users DESC, charger_id LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.map(({ charger_id: id, users, charger }) => {
    let name = null;
    try {
      const saved = JSON.parse(charger);
      name = saved.name || saved.operator || saved.address || null;
    } catch {
      // A copy that doesn't parse: the ID is enough to find it.
    }
    return { id, name, users };
  });
};

const OCCURRENCES_PAGE_SIZE = 20;
const ERROR_GROUP_PATH = /^\/api\/admin\/errors\/([0-9a-f]{8})$/;

const pageOf = (url) => Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);

// Errors grouped by fingerprint, the most recently seen first, with the
// details of the last one recorded.
const errorGroups = async (db, page) => {
  const { total } = await db
    .prepare("SELECT COUNT(DISTINCT fingerprint) AS total FROM errors")
    .first();
  const { results } = await db
    .prepare(
      `SELECT errors.fingerprint, errors.source, errors.name, errors.message, errors.url,
         errors.context, groups.count, groups.users, groups.first_seen, groups.last_seen
       FROM (
         SELECT fingerprint, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users,
           MIN(created_at) AS first_seen, MAX(created_at) AS last_seen, MAX(id) AS last_id
         FROM errors GROUP BY fingerprint
       ) AS groups
       JOIN errors ON errors.id = groups.last_id
       ORDER BY groups.last_seen DESC, groups.last_id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(ERRORS_PAGE_SIZE, (page - 1) * ERRORS_PAGE_SIZE)
    .all();
  return { groups: results, page, pages: Math.max(1, Math.ceil(total / ERRORS_PAGE_SIZE)), total };
};

// One error's occurrences, newest first.
const errorOccurrences = async (db, fingerprint, page) => {
  const { total } = await db
    .prepare("SELECT COUNT(*) AS total FROM errors WHERE fingerprint = ?")
    .bind(fingerprint)
    .first();
  const { results } = await db
    .prepare(
      `SELECT id, source, name, message, stack, url, method, context, user_agent, user_id,
         country, created_at
       FROM errors WHERE fingerprint = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(fingerprint, OCCURRENCES_PAGE_SIZE, (page - 1) * OCCURRENCES_PAGE_SIZE)
    .all();
  return {
    fingerprint,
    occurrences: results,
    page,
    pages: Math.max(1, Math.ceil(total / OCCURRENCES_PAGE_SIZE)),
    total,
  };
};

// The admin API (the guard has checked the user is an admin):
// - GET /api/admin/me: who the admin is
// - GET /api/admin/errors?page=: errors grouped, most recent first
// - GET /api/admin/errors/{fingerprint}?page=: one error's occurrences
// - GET /api/admin/usage?days=7|30|90: usage stats, and the most favorited
//   chargers
const adminApiResponse = async (request, env, user) => {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (url.pathname === `${ADMIN_API_PREFIX}me`) {
    return json({ admin: true, email: user.email });
  }
  if (url.pathname === `${ADMIN_API_PREFIX}errors`) {
    return json(await errorGroups(env.ADMIN_DB, pageOf(url)));
  }
  if (url.pathname === `${ADMIN_API_PREFIX}usage`) {
    const days = Number(url.searchParams.get("days"));
    const [stats, favorited] = await Promise.all([
      usageStats(env.ADMIN_DB, USAGE_PERIODS.includes(days) ? days : 30),
      env.DB ? mostFavorited(env.DB) : [],
    ]);
    return json({ ...stats, mostFavorited: favorited });
  }
  const fingerprint = url.pathname.match(ERROR_GROUP_PATH)?.[1];
  if (fingerprint) {
    return json(await errorOccurrences(env.ADMIN_DB, fingerprint, pageOf(url)));
  }
  return json({ error: "Not found" }, 404);
};

// Only Chealt's own people: the guard checks they're admins.
const routes = [
  {
    name: "admin",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    // Only its own paths: other domains have admin routes too.
    matches: (request, url) => ADMIN_API_PATH.test(url.pathname),
    handle: ({ request, env, user }) => adminApiResponse(request, env, user),
  },
];

const pageRoutes = [
  {
    name: "admin page",
    matches: (request, url) => isAdminPage(url.pathname),
    handle: async ({ request, env, context, signedInUser, renderAppPage }) =>
      adminPageResponse(request, env, await signedInUser(), { render: renderAppPage, context }),
  },
];

export {
  ADMIN_API_PREFIX,
  adminApiResponse,
  adminPageResponse,
  isAdmin,
  isAdminPage,
  mostFavorited,
  pageRoutes,
  routes,
  usageStats,
};
