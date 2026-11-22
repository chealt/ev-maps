// Publishes CI's Playwright report for the admin area (packages/worker's
// src/test-reports.js): uploads the HTML report to R2, records the run in the
// admin database, and links to it in a commit status on GitHub.
//
//   bun scripts/publish-test-report.js
//
// From the environment: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID;
// GITHUB_TOKEN and GITHUB_REPOSITORY; REPORT_ID ("{run ID}-{attempt}"),
// COMMIT_SHA, BRANCH, PULL_REQUEST (if any) and RUN_URL; SITE_URL (where the
// admin area is). It reads playwright-report/ and playwright-results.json.

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPORT_DIR = "playwright-report";
const RESULTS_FILE = "playwright-results.json";
const BUCKET = "ev-maps-test-reports";
const ADMIN_DATABASE = "ev-maps-admin";
const WRANGLER_TOML = new URL("../../worker/wrangler.toml", import.meta.url);
const CONCURRENCY = 16;
const STATUS_CONTEXT = "Playwright report";

const env = (name, { optional = false } = {}) => {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`${name} isn't set`);
  }
  return value || null;
};

const cloudflare = async (path, init) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}${path}`,
    {
      ...init,
      headers: { authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`, ...init.headers },
    }
  );
  if (!response.ok) {
    throw new Error(`Cloudflare ${path}: ${response.status} ${await response.text()}`);
  }
  return response;
};

const filesIn = async (directory) =>
  (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

// Every file of the report under reports/{id}/, CONCURRENCY at a time.
const uploadReport = async (id) => {
  const files = await filesIn(REPORT_DIR);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const key = `reports/${id}/${relative(REPORT_DIR, file).split("\\").join("/")}`;
      const encodedKey = key.split("/").map(encodeURIComponent).join("/");
      await cloudflare(`/r2/buckets/${BUCKET}/objects/${encodedKey}`, {
        method: "PUT",
        body: await readFile(file),
        headers: {},
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return files.length;
};

// The admin database's ID, from the Worker's configuration.
const adminDatabaseId = async () => {
  const toml = await readFile(WRANGLER_TOML, "utf8");
  const id = new RegExp(`database_name = "${ADMIN_DATABASE}"\\ndatabase_id = "([^"]+)"`).exec(
    toml
  )?.[1];
  if (!id) {
    throw new Error(`No ${ADMIN_DATABASE} in wrangler.toml`);
  }
  return id;
};

const recordReport = async (report) => {
  await cloudflare(`/d1/database/${await adminDatabaseId()}/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sql: `INSERT OR REPLACE INTO test_reports (id, branch, commit_sha, pull_request, run_url,
        status, passed, failed, flaky, skipped, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        report.id,
        report.branch,
        report.commitSha,
        report.pullRequest,
        report.runUrl,
        report.status,
        report.passed,
        report.failed,
        report.flaky,
        report.skipped,
        report.durationMs,
        Date.now(),
      ],
    }),
  });
};

const setCommitStatus = async (report, url) => {
  const response = await fetch(
    `https://api.github.com/repos/${env("GITHUB_REPOSITORY")}/statuses/${report.commitSha}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("GITHUB_TOKEN")}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        state: report.status === "passed" ? "success" : "failure",
        target_url: url,
        description: `${report.passed} passed, ${report.failed} failed, ${report.flaky} flaky`,
        context: STATUS_CONTEXT,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`GitHub status: ${response.status} ${await response.text()}`);
  }
};

// The run's numbers, from Playwright's JSON reporter.
const reportOf = async () => {
  const { stats } = JSON.parse(await readFile(RESULTS_FILE, "utf8"));
  const pullRequest = env("PULL_REQUEST", { optional: true });
  return {
    id: env("REPORT_ID"),
    branch: env("BRANCH", { optional: true }),
    commitSha: env("COMMIT_SHA"),
    pullRequest: pullRequest ? Number(pullRequest) : null,
    runUrl: env("RUN_URL", { optional: true }),
    status: stats.unexpected > 0 ? "failed" : "passed",
    passed: stats.expected,
    failed: stats.unexpected,
    flaky: stats.flaky,
    skipped: stats.skipped,
    durationMs: Math.round(stats.duration),
  };
};

const report = await reportOf();
const files = await uploadReport(report.id);
// Until a deploy from main has created the table (admin-migrations), the
// report can't be listed yet; it's still linked from the commit status.
await recordReport(report).catch((error) =>
  console.warn(`The report isn't listed in the admin area: ${error.message}`)
);
const url = `${env("SITE_URL")}/en/admin/reports/${report.id}/`;
await setCommitStatus(report, url);
console.log(`Published ${files} files of the Playwright report: ${url}`);
