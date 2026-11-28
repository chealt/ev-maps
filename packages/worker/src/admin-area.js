// EV Maps' configuration of the generic admin package (@ev-maps/admin): the
// site's locales, the events its pages count, the server-rendered admin
// pages, and the extra stats of the usage API (the most favorited chargers).
// Everything here is EV Maps; the package itself knows none of it.

import { createAdminArea, errorFilters } from "@ev-maps/admin/admin.js";
import { dashboard } from "@ev-maps/admin/admin-dashboard.js";
import { preferenceStats } from "./preference-stats.js";
import { performancePage } from "@ev-maps/admin/performance-stats.js";
import { createTestReports } from "@ev-maps/admin/test-reports.js";
import { createUsage } from "@ev-maps/admin/usage.js";
import { listAdminFlags } from "./charger-unavailability.js";
import { listAdminReports } from "./charger-reports.js";
import { listAdminSuggestions } from "./charger-suggestions.js";

const LOCALES = ["en", "pl", "hu", "es", "de", "fr", "sk", "cs", "nb", "sv", "pt", "it"];

// The events the pages may send, and how their dimension looks.
const PAGE_EVENTS = {
  page_view: /^(en|pl|hu|es|de|fr|sk|cs|nb|sv|pt|it):(home|country|legal)$/,
  // Which page: the site's own (not the admin area), e.g. /hu/hu/.
  page_path: /^\/(en|pl|hu|es|de|fr|sk|cs|nb|sv|pt|it)\/([a-z]{2}\/|privacy\/|terms\/)?$/,
  charger_opened: /^[a-z]{2,10}$/,
  filter_used: /^[a-z-]{2,20}$/,
  locate_me: /^$/,
  list_opened: /^$/,
  sign_in_started: /^[a-z]{2,12}$/,
  // The device's own settings on a page view, e.g. "theme:dark" (#373).
  preference: /^(theme:(system|light|dark)|animations:(on|off|reduced))$/,
};

// The admin review pages' ?status= as the admin API takes it: pending when
// there's none, every status (none) for "all".
const reviewStatusUrl = (url) => {
  const status = url.searchParams.get("status") ?? "pending";
  const apiUrl = new URL(url);
  apiUrl.search = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  return apiUrl;
};

// The reports page's ?branch= as the reports API takes it: main when there's
// none, every branch (none) for "all".
const reportsUrl = (url) => {
  const branch = url.searchParams.get("branch") || "main";
  const apiUrl = new URL(url);
  if (branch === "all") {
    apiUrl.searchParams.delete("branch");
  } else {
    apiUrl.searchParams.set("branch", branch);
  }
  return apiUrl;
};

const usage = createUsage({ events: PAGE_EVENTS });

// The chargers most users have as a favorite now (the main database's
// favorites), most first, as the usage API's top items: [{ id, name, count }].
// The name is from the copy the favorites keep.
const MOST_FAVORITED = 10;
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
    return { id, name, count: users };
  });
};

const pageOf = (url) => Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);

const admin = createAdminArea({
  locales: LOCALES,
  usageExtraStats: async (env) => ({ top: env.DB ? await mostFavorited(env.DB) : [] }),
  serverPages: [
    {
      // The chargers reported unavailable, rendered on the server (#371).
      path: "unavailability",
      data: (env) => listAdminFlags(env.DB),
    },
    {
      // The charger reports, rendered on the server: ?status= pending (the
      // default), approved, rejected or all.
      path: "charger-reports",
      data: (env, url) => listAdminReports(env.DB, reviewStatusUrl(url)),
    },
    {
      // The overview, with its dashboard, rendered on the server.
      path: new RegExp(`^/(${LOCALES.join("|")})/admin/$`),
      data: (env) => dashboard(env.ADMIN_DB),
    },
    {
      // The charger suggestions, rendered on the server, with ?status= too.
      path: "suggestions",
      data: (env, url) => listAdminSuggestions(env.DB, reviewStatusUrl(url)),
    },
    {
      // The usage stats of ?days=, rendered on the server.
      path: "usage",
      data: (env, url) => admin.usage(env, url),
    },
    {
      // A page of CI's test reports, of ?branch= (main by default, "all"
      // for every branch), rendered on the server.
      path: "reports",
      data: (env, url) => testReports.reports(env, reportsUrl(url)),
    },
    {
      // What users prefer, a page per section (#373), rendered on the
      // server.
      path: "usage/(settings|filters|routes)",
      data: (env) => preferenceStats(env),
    },
    {
      // The summary of ?days=, or a trace's spans (?trace=), rendered on
      // the server.
      path: "performance",
      data: (env, url) => performancePage(env.ADMIN_DB, url),
    },
    {
      // The errors page is rendered on the server, per request.
      path: "errors",
      data: (env, url) => {
        const error = url.searchParams.get("error");
        return /^[0-9a-f]{8}$/.test(error ?? "")
          ? admin.errorOccurrences(env.ADMIN_DB, error, pageOf(url))
          : admin.errorGroups(env.ADMIN_DB, pageOf(url), errorFilters(url));
      },
    },
  ],
});

const testReports = createTestReports({ locales: LOCALES, isAdmin: admin.isAdmin });

const adminApiResponse = admin.adminApiResponse;
const adminPageResponse = admin.adminPageResponse;
const adminRoutes = admin.routes;
const adminPageRoutes = admin.pageRoutes;
const countEvent = usage.countEvent;
const isAdmin = admin.isAdmin;
const isAdminPage = admin.isAdminPage;
const testReportsJobs = testReports.jobs;
const testReportsPageRoutes = testReports.pageRoutes;
const testReportsRoutes = testReports.routes;
const usageJobs = usage.jobs;
const usageRoutes = usage.routes;

export {
  adminApiResponse,
  adminPageResponse,
  adminRoutes,
  adminPageRoutes,
  countEvent,
  isAdmin,
  isAdminPage,
  mostFavorited,
  testReportsJobs,
  testReportsPageRoutes,
  testReportsRoutes,
  usage,
  usageJobs,
  usageRoutes,
};
