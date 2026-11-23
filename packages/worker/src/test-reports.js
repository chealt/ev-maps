// The Playwright reports of CI runs, for admins only. CI uploads each HTML
// report to R2 (the REPORTS bucket, reports/{id}/) and records it in the
// admin database (test_reports); see packages/app/scripts/publish-test-report.js.
//
// - GET /api/admin/test-reports?page=: the reports, the latest first
// - /{lang}/admin/reports/{id}/{file}: the report's files, from R2; the
//   report's own links (data/, trace/) stay under it

import { EVERY_15_MINUTES } from "./crons.js";
import { isAdmin } from "./admin.js";

const LIST_PATH = "/api/admin/test-reports";
const FILE_PATH = /^\/(?:en|pl|hu)\/admin\/reports\/(\d+-\d+)\/(.*)$/;
const PAGE_SIZE = 20;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webm: "video/webm",
  zip: "application/zip",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  ttf: "font/ttf",
  woff2: "font/woff2",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

// A page of the reports, the latest first, of one branch or (branch null)
// all; with the branches that have reports, most recently run first, for the
// filter.
const listReports = async (db, page, branch = null) => {
  const where = branch === null ? "" : "WHERE branch = ?";
  const filter = branch === null ? [] : [branch];
  const [{ total }, { results }, { results: branches }] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS total FROM test_reports ${where}`)
      .bind(...filter)
      .first(),
    db
      .prepare(`SELECT * FROM test_reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...filter, PAGE_SIZE, (page - 1) * PAGE_SIZE)
      .all(),
    db
      .prepare(
        `SELECT branch FROM test_reports WHERE branch IS NOT NULL
         GROUP BY branch ORDER BY MAX(created_at) DESC`
      )
      .all(),
  ]);
  return {
    reports: results,
    branch,
    branches: branches.map((row) => row.branch),
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
};

const contentTypeOf = (file) =>
  CONTENT_TYPES[file.split(".").pop()?.toLowerCase()] ?? "application/octet-stream";

// A report's file, for admins; for everyone else, as if there were none.
const reportFileResponse = async (request, env, user, url) => {
  if (!isAdmin(env, user) || !env.REPORTS) {
    return notFound();
  }
  return reportFile(url, env, { cacheControl: "private, max-age=3600" });
};

// The UI evidence of a run's @ui tests (scripts/ui-evidence.js):
// screenshots and videos of the app's own UI, published to be embedded
// outside the admin area, e.g. in a pull request's comment. Only these
// files of a report are public; the rest stays for admins.
const UI_FILE_PATH = /^\/reports\/(\d+-\d+)\/(ui\/[\w-]+\.(?:png|webm))$/;

const uiFileResponse = async (request, env, url) => {
  if (!env.REPORTS || !UI_FILE_PATH.test(url.pathname)) {
    return notFound();
  }
  return reportFile(url, env, { cacheControl: "public, max-age=86400" });
};

// The R2 object behind a report's file path, with the given caching.
const reportFile = async (url, env, { cacheControl }) => {
  const match = url.pathname.match(FILE_PATH) ?? url.pathname.match(UI_FILE_PATH);
  const [, id, file] = match;
  const key = `reports/${id}/${decodeURIComponent(file || "index.html")}`;
  if (key.includes("..")) {
    return notFound();
  }
  const object = await env.REPORTS.get(key);
  if (!object) {
    return notFound();
  }
  return new Response(object.body, {
    headers: {
      "content-type": contentTypeOf(key),
      "cache-control": cacheControl,
      "x-robots-tag": "noindex, nofollow",
    },
  });
};

const deleteOldReports = async (env, now = Date.now()) => {
  await env.ADMIN_DB?.prepare("DELETE FROM test_reports WHERE created_at < ?")
    .bind(now - KEEP_MS)
    .run();
};

const routes = [
  {
    name: "test reports",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => request.method === "GET" && url.pathname === LIST_PATH,
    handle: async ({ env, url }) => {
      const page = Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);
      // ?branch=main for one branch; without it, every branch.
      const branch = url.searchParams.get("branch")?.slice(0, 200) || null;
      return json(await listReports(env.ADMIN_DB, page, branch));
    },
  },
];

const pageRoutes = [
  {
    name: "test report",
    // CI's reports, not the site: not in the performance numbers.
    untraced: true,
    matches: (request, url) => request.method === "GET" && FILE_PATH.test(url.pathname),
    handle: async ({ request, env, url, signedInUser }) =>
      reportFileResponse(request, env, await signedInUser(), url),
  },
  {
    name: "ui evidence",
    // Fetched by GitHub for pull request comments, not by users.
    untraced: true,
    matches: (request, url) => request.method === "GET" && UI_FILE_PATH.test(url.pathname),
    handle: async ({ request, env, url }) => uiFileResponse(request, env, url),
  },
];

const jobs = [
  { name: "delete old test reports", cron: EVERY_15_MINUTES, run: (env) => deleteOldReports(env) },
];

export {
  contentTypeOf,
  deleteOldReports,
  jobs,
  listReports,
  pageRoutes,
  reportFileResponse,
  routes,
  uiFileResponse,
};
