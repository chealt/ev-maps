// The "Visual review" commit status of a pull request (#309, docs/CI.md):
// after scripts/publish-test-report.js, from the merged run's JSON summary.
// captureUi marks each @ui moment that differs from main's, or that main
// doesn't have, with a "visual-change" annotation, and Playwright attaches the
// expected, actual and diff images to the test in the report. Nothing changed:
// green; something did: pending, until the App workflow's Visual approval job
// is approved by a person.
//
//   bun scripts/visual-review.js
//
// From the environment: report-storage.js's GitHub settings, and REPORT_ID,
// COMMIT_SHA and SITE_URL.

import { appendFile, readFile } from "node:fs/promises";
import { env, postCommitStatus } from "./report-storage.js";

const RESULTS_FILE = "playwright-results.json";
const STATUS_CONTEXT = "Visual review";

// [{ test, change: "changed" | "new", screenshot }] from the JSON summary:
// each annotation of a test's last attempt.
const visualChanges = (results) => {
  const changes = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const last = test.results.at(-1);
        for (const { type, description } of last?.annotations ?? test.annotations ?? []) {
          if (type === "visual-change") {
            const [change, screenshot] = description.split(": ");
            changes.push({ test: [...titles, spec.title].join(" › "), change, screenshot });
          }
        }
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, suite.title && !suite.title.endsWith(".js") ? [...titles, suite.title] : titles);
    }
  };
  for (const suite of results.suites ?? []) {
    walk(suite, []);
  }
  return changes;
};

// The commit status: success when nothing changed, pending when something did.
const reviewStatus = (changes) => {
  if (!changes.length) {
    return { state: "success", description: "No visual changes" };
  }
  const count = (kind) => changes.filter(({ change }) => change === kind).length;
  const parts = [
    count("changed") && `${count("changed")} changed`,
    count("new") && `${count("new")} new`,
  ].filter(Boolean);
  return {
    state: "pending",
    description: `${parts.join(", ")}: approve the visual changes (Visual approval job)`,
  };
};

if (import.meta.main) {
  const results = JSON.parse(await readFile(RESULTS_FILE, "utf8"));
  const changes = visualChanges(results);
  const url = `${env("SITE_URL")}/en/admin/reports/${env("REPORT_ID")}/`;
  await postCommitStatus(env("COMMIT_SHA"), {
    context: STATUS_CONTEXT,
    url,
    ...reviewStatus(changes),
  });
  for (const { test, change, screenshot } of changes) {
    console.log(`${change}: ${screenshot} (${test})`);
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `visual-changes=${changes.length}\nvisual-report-url=${url}\n`
    );
  }
}

export { reviewStatus, visualChanges };
