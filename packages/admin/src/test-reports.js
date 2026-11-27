// Test reports of CI runs, for admins only. CI uploads each HTML report to
// an object store (reports/{id}/) and records it in a database (test_reports).
//
// createTestReports({ locales, isAdmin }) builds the routes, page routes and
// jobs:
// - GET {listPath}?page=&branch=: the reports, the latest first
// - /{lang}{pagePrefix}/{id}/{file}: the report's files, from the store; the
//   report's own links (data/, trace/) stay under it

import { EVERY_15_MINUTES } from "./crons.js";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DEFAULT_LIST_PATH = "/api/admin/test-reports";
const DEFAULT_PAGE_PREFIX = "/admin/reports";
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

// The object behind a report's file path, with the given caching.
const reportFile = async (url, bucket, { cacheControl, filePath, uiFilePath }) => {
  const match = url.pathname.match(filePath) ?? url.pathname.match(uiFilePath);
  const [, id, file] = match;
  const key = `reports/${id}/${decodeURIComponent(file || "index.html")}`;
  if (key.includes("..")) {
    return notFound();
  }
  const object = await bucket.get(key);
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

// A report's file, for admins; for everyone else, as if there were none.
const reportFileResponse = (isAdmin, filePath, uiFilePath) => async (request, env, user, url) => {
  const bucket = env.REPORTS;
  if (!isAdmin(env, user) || !bucket) {
    return notFound();
  }
  return reportFile(url, bucket, { cacheControl: "private, max-age=3600", filePath, uiFilePath });
};

// A run's public evidence files (e.g. screenshots and videos), published to
// be embedded outside the admin area, such as in a pull request's comment.
// Only these files of a report are public; the rest stays for admins.
const UI_FILE_PATH = /^\/reports\/(\d+-\d+)\/(ui\/[\w-]+\.(?:png|webm))$/;

const uiFileResponse = (uiFilePath, filePath) => async (request, env, url) => {
  const bucket = env.REPORTS;
  if (!bucket || !uiFilePath.test(url.pathname)) {
    return notFound();
  }
  return reportFile(url, bucket, { cacheControl: "public, max-age=86400", filePath, uiFilePath });
};

const deleteOldReports = async (db, now = Date.now()) => {
  await db
    ?.prepare("DELETE FROM test_reports WHERE created_at < ?")
    .bind(now - KEEP_MS)
    .run();
};

// createTestReports({ locales, isAdmin, listPath, pagePrefix, db }) builds
// the module's routes, page routes and jobs. db is (env) => the database
// binding, defaulting to ADMIN_DB; the object store is the REPORTS binding.
const createTestReports = ({
  locales,
  isAdmin,
  listPath = DEFAULT_LIST_PATH,
  pagePrefix = DEFAULT_PAGE_PREFIX,
  db = (env) => env.ADMIN_DB,
}) => {
  const locale = locales.map(escapeRegExp).join("|");
  const filePath = new RegExp(`^/(?:${locale})${escapeRegExp(pagePrefix)}/(\\d+-\\d+)/(.*)$`);
  const fileResponse = reportFileResponse(isAdmin, filePath, UI_FILE_PATH);
  const uiResponse = uiFileResponse(UI_FILE_PATH, filePath);
  // A page of the reports: ?page=, and ?branch=main for one branch; without
  // it, every branch. For the API and the reports page.
  const reports = (env, url) => {
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);
    const branch = url.searchParams.get("branch")?.slice(0, 200) || null;
    return listReports(db(env), page, branch);
  };
  const routes = [
    {
      name: "test reports",
      limiter: "ADMIN_LIMITER",
      signedIn: true,
      admin: true,
      matches: (request, url) => request.method === "GET" && url.pathname === listPath,
      handle: async ({ env, url }) => json(await reports(env, url)),
    },
  ];
  const pageRoutes = [
    {
      name: "test report",
      // CI's reports, not the site: not in the performance numbers.
      untraced: true,
      matches: (request, url) => request.method === "GET" && filePath.test(url.pathname),
      handle: async ({ request, env, url, signedInUser }) =>
        reportFileResponse(isAdmin, filePath, UI_FILE_PATH)(
          request,
          env,
          await signedInUser(),
          url
        ),
    },
    {
      name: "ui evidence",
      // Fetched by CI for pull request comments, not by users.
      untraced: true,
      matches: (request, url) => request.method === "GET" && UI_FILE_PATH.test(url.pathname),
      handle: async ({ request, env, url }) =>
        uiFileResponse(UI_FILE_PATH, filePath)(request, env, url),
    },
  ];
  const jobs = [
    {
      name: "delete old test reports",
      cron: EVERY_15_MINUTES,
      run: (env) => deleteOldReports(db(env)),
    },
  ];
  return {
    jobs,
    pageRoutes,
    reportFileResponse: fileResponse,
    reports,
    routes,
    uiFileResponse: uiResponse,
  };
};

export {
  contentTypeOf,
  createTestReports,
  deleteOldReports,
  listReports,
  reportFileResponse,
  uiFileResponse,
};
