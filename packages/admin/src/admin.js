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

// In SQL: the browser and the system in a user agent, best effort, e.g. for
// the groups' columns and the filters.
const BROWSER_SQL = `CASE
  WHEN user_agent LIKE '%Firefox/%' THEN 'Firefox'
  WHEN user_agent LIKE '%Edg/%' THEN 'Edge'
  WHEN user_agent LIKE '%OPR/%' THEN 'Opera'
  WHEN user_agent LIKE '%Chrome/%' THEN 'Chrome'
  WHEN user_agent LIKE '%Safari/%' THEN 'Safari'
  WHEN user_agent IS NOT NULL THEN 'Other'
END`;
const OS_SQL = `CASE
  WHEN user_agent LIKE '%Android%' THEN 'Android'
  WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
  WHEN user_agent LIKE '%Windows%' THEN 'Windows'
  WHEN user_agent LIKE '%Mac OS%' OR user_agent LIKE '%Macintosh%' THEN 'macOS'
  WHEN user_agent LIKE '%Linux%' THEN 'Linux'
  WHEN user_agent IS NOT NULL THEN 'Other'
END`;

// How the error groups can be ordered: ?sort= to the ORDER BY.
const ERROR_SORTS = {
  last_seen: "groups.last_seen DESC, groups.last_id DESC",
  first_seen: "groups.first_seen DESC, groups.last_id DESC",
  count: "groups.count DESC, groups.last_seen DESC",
};

// The error filters and order from a page's or the API's URL: ?source=
// (worker or page), ?country=, ?browser=, ?os=, ?q= (in the message, URL or
// job) and ?sort= (last_seen, first_seen or count).
const errorFilters = (url) => {
  const param = (name) => {
    const value = url.searchParams.get(name)?.trim();
    return value && value.length <= 100 ? value : null;
  };
  const source = param("source");
  const country = param("country");
  const sort = param("sort");
  return {
    sort: sort && sort in ERROR_SORTS ? sort : "last_seen",
    source: ["worker", "page"].includes(source) ? source : null,
    country: /^[A-Za-z]{2}$/.test(country ?? "") ? country.toUpperCase() : null,
    browser: param("browser"),
    os: param("os"),
    q: param("q"),
  };
};

const errorWhere = ({ source, country, browser, os, q }) => {
  const clauses = [];
  const params = [];
  if (source) {
    clauses.push("source = ?");
    params.push(source);
  }
  if (country) {
    clauses.push("country = ?");
    params.push(country);
  }
  if (browser) {
    clauses.push(`${BROWSER_SQL} = ?`);
    params.push(browser);
  }
  if (os) {
    clauses.push(`${OS_SQL} = ?`);
    params.push(os);
  }
  if (q) {
    clauses.push("(message LIKE ? OR url LIKE ? OR context LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

// The values the filters offer, from all the errors kept.
const errorFacets = async (db) => {
  const values = async (select) =>
    (await db.prepare(select).all()).results.map(({ value }) => value);
  return {
    sources: ["worker", "page"],
    countries: await values(
      "SELECT DISTINCT country AS value FROM errors WHERE country IS NOT NULL ORDER BY value"
    ),
    browsers: await values(
      `SELECT DISTINCT ${BROWSER_SQL} AS value FROM errors WHERE user_agent IS NOT NULL ORDER BY value`
    ),
    oss: await values(
      `SELECT DISTINCT ${OS_SQL} AS value FROM errors WHERE user_agent IS NOT NULL ORDER BY value`
    ),
  };
};

// Errors grouped by fingerprint, ordered by `filters.sort` (the most
// recently seen first by default), with the details of the last matching one
// recorded. `filters` are errorFilters()'s; only the occurrences matching
// them count.
const errorGroups = async (db, page, filters = {}) => {
  const { where, params } = errorWhere(filters);
  const order = ERROR_SORTS[filters.sort] ?? ERROR_SORTS.last_seen;
  const { total } = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM (SELECT fingerprint FROM errors ${where} GROUP BY fingerprint)`
    )
    .bind(...params)
    .first();
  const { results } = await db
    .prepare(
      `SELECT errors.fingerprint, errors.source, errors.name, errors.message, errors.url,
         errors.context, errors.country, ${BROWSER_SQL} AS browser, ${OS_SQL} AS os,
         groups.count, groups.users, groups.first_seen, groups.last_seen
       FROM (
         SELECT fingerprint, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users,
           MIN(created_at) AS first_seen, MAX(created_at) AS last_seen, MAX(id) AS last_id
         FROM errors ${where} GROUP BY fingerprint
       ) AS groups
       JOIN errors ON errors.id = groups.last_id
       ORDER BY ${order}
       LIMIT ? OFFSET ?`
    )
    .bind(...params, ERRORS_PAGE_SIZE, (page - 1) * ERRORS_PAGE_SIZE)
    .all();
  return {
    groups: results,
    page,
    pages: Math.max(1, Math.ceil(total / ERRORS_PAGE_SIZE)),
    total,
    sort: filters.sort ?? "last_seen",
    filters,
    facets: await errorFacets(db),
  };
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

  // The usage stats of ?days= (one of usagePeriods, else the middle one),
  // plus the host's extra stats: for the usage API and the usage page.
  const usage = async (env, url) => {
    const days = Number(url.searchParams.get("days"));
    const period = usagePeriods.includes(days) ? days : (usagePeriods[1] ?? 30);
    const [stats, extra] = await Promise.all([usageStats(db(env), period), usageExtraStats(env)]);
    return { period, ...stats, ...extra };
  };

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
      return json(await errorGroups(db(env), pageOf(url), errorFilters(url)));
    }
    if (url.pathname === `${apiPrefix}usage`) {
      return json(await usage(env, url));
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
    usage,
    usagePeriods,
    usageStats,
  };
};

export { createAdminArea, errorFilters, errorGroups, errorOccurrences, usageStats };
