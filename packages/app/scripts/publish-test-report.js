// Publishes CI's Playwright report for the admin area (packages/worker's
// src/test-reports.js): uploads the HTML report to R2, records the run in the
// admin database, and links to it in a commit status on GitHub.
//
//   bun scripts/publish-test-report.js
//
// From the environment: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (the
// admin database); R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (an R2 API
// token with Object Read & Write on the bucket, for its S3 API);
// GITHUB_TOKEN and GITHUB_REPOSITORY; REPORT_ID ("{run ID}-{attempt}"),
// COMMIT_SHA, BRANCH, PULL_REQUEST (if any) and RUN_URL; SITE_URL (where the
// admin area is). It reads playwright-report/ and playwright-results.json,
// and publishes the accessibility report (scripts/a11y-report.js) in the
// report's a11y/ folder and the performance report
// (scripts/performance-report.js) in performance/, each with its own commit
// status.

import { appendFile, readFile } from "node:fs/promises";
import { env, postCommitStatus, uploadFolder } from "./report-storage.js";
import { REPORT_DIR as A11Y_REPORT_DIR, writeA11yReport } from "./a11y-report.js";
import {
  REPORT_DIR as PERFORMANCE_REPORT_DIR,
  writePerformanceReport,
} from "./performance-report.js";

const REPORT_DIR = "playwright-report";
const RESULTS_FILE = "playwright-results.json";
const ADMIN_DATABASE = "ev-maps-admin";
const WRANGLER_TOML = new URL("../../worker/wrangler.toml", import.meta.url);
const STATUS_CONTEXT = "Playwright report";
const A11Y_STATUS_CONTEXT = "Accessibility report";
const PERFORMANCE_STATUS_CONTEXT = "Performance report";

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
const files = await uploadFolder(REPORT_DIR, `${report.id}/`);
// Until a deploy from main has created the table (admin-migrations), the
// report can't be listed yet; it's still linked from the commit status.
await recordReport(report).catch((error) =>
  console.warn(`The report isn't listed in the admin area: ${error.message}`)
);
const url = `${env("SITE_URL")}/en/admin/reports/${report.id}/`;
await postCommitStatus(report.commitSha, {
  state: report.status === "passed" ? "success" : "failure",
  description: `${report.passed} passed, ${report.failed} failed, ${report.flaky} flaky`,
  context: STATUS_CONTEXT,
  url,
});
console.log(`Published ${files} files of the Playwright report: ${url}`);

// The accessibility report (scripts/a11y-report.js), next to it in a11y/.
const a11y = await writeA11yReport();
await uploadFolder(A11Y_REPORT_DIR, `${report.id}/a11y/`);
const a11yUrl = `${url}a11y/index.html`;
await postCommitStatus(report.commitSha, {
  state: a11y.violations > 0 ? "failure" : "success",
  description: `${a11y.tests} pages checked, ${a11y.violations} rules violated, ${a11y.incomplete} to check by hand`,
  context: A11Y_STATUS_CONTEXT,
  url: a11yUrl,
});
console.log(`Published the accessibility report: ${a11yUrl}`);

// The performance report (scripts/performance-report.js), in performance/.
const performance = await writePerformanceReport();
await uploadFolder(PERFORMANCE_REPORT_DIR, `${report.id}/performance/`);
const performanceUrl = `${url}performance/index.html`;
await postCommitStatus(report.commitSha, {
  state: performance.poor > 0 ? "failure" : "success",
  description: `${performance.pages} pages measured, ${performance.poor} poor P75s`,
  context: PERFORMANCE_STATUS_CONTEXT,
  url: performanceUrl,
});
console.log(`Published the performance report: ${performanceUrl}`);

// For the release notes (the App workflow's Release job): the step's outputs.
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `report-url=${url}\na11y-report-url=${a11yUrl}\n` +
      `summary=${report.passed} passed, ${report.failed} failed, ${report.flaky} flaky\n` +
      `a11y-summary=${a11y.tests} pages checked, ${a11y.violations} rules violated\n` +
      `performance-report-url=${performanceUrl}\n` +
      `performance-summary=${performance.pages} pages measured, ${performance.poor} poor P75s\n`
  );
}
