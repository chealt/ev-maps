// A generic admin area, for the host's own people: users whose verified
// email is at a configured domain. Checked here, on the server, for both
// the admin pages (/{lang}/admin/) and the admin API (/api/admin/*).
//
// createAdminArea(options) builds it; everything site-specific is an option:
// the locales, the extra stats the usage API adds (e.g. the host's top
// items), and the server-rendered pages with their data.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const pageOf = (url) => Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);

const ERRORS_PAGE_SIZE = 25;
const OCCURRENCES_PAGE_SIZE = 20;
const DEFAULT_USAGE_PERIODS = [7, 30, 90];
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

// The admin area, configured by the host:
// - locales: the site's languages, e.g. ["en", "pl", "hu"]
// - db: (env) => the admin database binding
// - emailDomainEnv: the env var with the admins' email domain
// - usagePeriods: the ?days= the usage API answers, default [7, 30, 90]
// - usageExtraStats: async (env) => extra fields for the usage API, e.g.
//   { top: [{ id, name, count }] }
// - serverPages: [{ path, data }] the pages rendered on the server, with
//   their data; path is a RegExp, data is async (env, url)
const createAdminArea = ({
  locales,
  db = (env) => env.ADMIN_DB,
  emailDomainEnv = "ADMIN_EMAIL_DOMAIN",
  apiPrefix = "/api/admin/",
  pagePrefix = "/admin",
  usagePeriods = DEFAULT_USAGE_PERIODS,
  usageExtraStats = async () => ({}),
  serverPages = [],
}) => {
  const locale = locales.map(escapeRegExp).join("|");
  const adminPagePath = new RegExp(`^/(${locale})${escapeRegExp(pagePrefix)}(/.*)?$`);
  const adminApiPath = new RegExp(`^${escapeRegExp(apiPrefix)}(me|usage|errors(/[0-9a-f]{8})?)$`);
  const errorGroupPath = new RegExp(`^${escapeRegExp(apiPrefix)}errors/([0-9a-f]{8})$`);
  const serverRenderedPages = serverPages.map((page) => ({
    ...page,
    path:
      page.path instanceof RegExp
        ? page.path
        : new RegExp(`^/(${locale})${escapeRegExp(pagePrefix)}/${page.path}/$`),
  }));

  // `user` is { id, email } of a signed-in user with a verified email, or null.
  const isAdmin = (env, user) => {
    const domain = env[emailDomainEnv]?.toLowerCase();
    return Boolean(domain && user?.email?.toLowerCase().endsWith(`@${domain}`));
  };

  const isAdminPage = (pathname) => adminPagePath.test(pathname);

  // The admin API (the guard has checked the user is an admin):
  // - GET {apiPrefix}me: who the admin is
  // - GET {apiPrefix}errors?page=: errors grouped, most recent first
  // - GET {apiPrefix}errors/{fingerprint}?page=: one error's occurrences
  // - GET {apiPrefix}usage?days=: usage stats, plus the host's extra stats
  const adminApiResponse = async (request, env, user) => {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (url.pathname === `${apiPrefix}me`) {
      return json({ admin: true, email: user.email });
    }
    if (url.pathname === `${apiPrefix}errors`) {
      return json(await errorGroups(db(env), pageOf(url)));
    }
    if (url.pathname === `${apiPrefix}usage`) {
      const days = Number(url.searchParams.get("days"));
      const [stats, extra] = await Promise.all([
        usageStats(db(env), usagePeriods.includes(days) ? days : (usagePeriods[1] ?? 30)),
        usageExtraStats(env),
      ]);
      return json({ ...stats, ...extra });
    }
    const fingerprint = url.pathname.match(errorGroupPath)?.[1];
    if (fingerprint) {
      return json(await errorOccurrences(db(env), fingerprint, pageOf(url)));
    }
    return json({ error: "Not found" }, 404);
  };

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
  // are static; the server-rendered ones go to `render` (the host's server)
  // with their data as props.
  const adminPageResponse = async (request, env, user, { render, context } = {}) => {
    if (!isAdmin(env, user)) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const url = new URL(request.url);
    const serverPage = serverRenderedPages.find(({ path }) => path.test(url.pathname));
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

  // Only admins: the guard checks they are.
  const routes = [
    {
      name: "admin",
      limiter: "ADMIN_LIMITER",
      signedIn: true,
      admin: true,
      // Only its own paths: other domains have admin routes too.
      matches: (request, url) => adminApiPath.test(url.pathname),
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

  return {
    adminApiResponse,
    adminPageResponse,
    errorGroups,
    errorOccurrences,
    isAdmin,
    isAdminPage,
    pageRoutes,
    routes,
    usageStats,
  };
};

export { createAdminArea, errorGroups, errorOccurrences, usageStats };
