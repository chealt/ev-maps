// Visual regression of the @ui tests' screenshots (#309), after
// scripts/publish-test-report.js has written them to ui-evidence/:
//
// - On main, they become the baseline: reports/ui-baseline/main.json names
//   the report whose ui/ folder has them.
// - On a pull request, each is compared with main's of the same name
//   (Playwright's toMatchSnapshot, scripts/visual/), the comparison's report
//   is published in the report's visual/ folder, and the "Visual review"
//   commit status says whether anything changed. While something did, it's
//   pending: the App workflow's Visual approval job, which a person has to
//   approve (the visual-review environment), turns it green.
//
//   bun scripts/visual-compare.js
//
// From the environment: report-storage.js's, and REPORT_ID, COMMIT_SHA,
// BRANCH, PULL_REQUEST (on pull requests) and SITE_URL.

import { appendFile, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env, postCommitStatus, reportBucket, uploadFolder } from "./report-storage.js";
import { EVIDENCE_DIR } from "./ui-evidence.js";

const BASELINE_KEY = "reports/ui-baseline/main.json";
const WORK_DIR = "visual-compare";
const STATUS_CONTEXT = "Visual review";

// The screenshots' files in a folder (none if there's no folder).
const screenshotsIn = async (directory) =>
  (await readdir(directory).catch(() => [])).filter((file) => file.endsWith(".png")).sort();

// The changed and new screenshots from the comparison's JSON report: every
// test that didn't pass, by its title (the file name).
const changesOf = (results, baselineFiles) => {
  const changed = [];
  const added = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const passed = spec.tests.every((test) =>
        test.results.some((result) => result.status === "passed")
      );
      if (!passed) {
        (baselineFiles.includes(spec.title) ? changed : added).push(spec.title);
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child);
    }
  };
  for (const suite of results.suites ?? []) {
    walk(suite);
  }
  return { changed, added };
};

// The commit status for the comparison: success when nothing changed,
// pending (to approve) when something did.
const reviewStatus = ({ changed, added }, compared) => {
  const count = changed.length + added.length;
  if (!count) {
    return { state: "success", description: `No visual changes in ${compared} screenshots` };
  }
  const parts = [
    changed.length && `${changed.length} changed`,
    added.length && `${added.length} new`,
  ].filter(Boolean);
  return {
    state: "pending",
    description: `${parts.join(", ")}: approve the visual changes (Visual approval job)`,
  };
};

const writeOutputs = async (outputs) => {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}\n`)
        .join("")
    );
  }
};

const saveBaseline = async (files) => {
  const baseline = { reportId: env("REPORT_ID"), commitSha: env("COMMIT_SHA"), files };
  await reportBucket().write(BASELINE_KEY, JSON.stringify(baseline), {
    type: "application/json",
  });
  console.log(`The baseline is now report ${baseline.reportId}: ${files.length} screenshots.`);
};

const compare = async (files) => {
  const commitSha = env("COMMIT_SHA");
  const status = (fields) => postCommitStatus(commitSha, { context: STATUS_CONTEXT, ...fields });
  if (!files.length) {
    await status({ state: "success", description: "No UI screenshots in this run" });
    await writeOutputs({ "visual-changes": 0 });
    return;
  }
  const bucket = reportBucket();
  const pointer = bucket.file(BASELINE_KEY);
  if (!(await pointer.exists())) {
    await status({ state: "success", description: "No baseline from main yet" });
    await writeOutputs({ "visual-changes": 0 });
    return;
  }
  const baseline = JSON.parse(await pointer.text());

  await rm(WORK_DIR, { recursive: true, force: true });
  await mkdir(join(WORK_DIR, "actual"), { recursive: true });
  await mkdir(join(WORK_DIR, "baseline"), { recursive: true });
  for (const file of files) {
    await copyFile(join(EVIDENCE_DIR, file), join(WORK_DIR, "actual", file));
    if (baseline.files.includes(file)) {
      const image = bucket.file(`reports/${baseline.reportId}/ui/${file}`);
      await writeFile(join(WORK_DIR, "baseline", file), new Uint8Array(await image.arrayBuffer()));
    }
  }

  // Exits non-zero when anything changed: that's the review's to decide.
  Bun.spawnSync(["bunx", "playwright", "test", "-c", "scripts/visual/playwright.config.js"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const results = JSON.parse(await readFile(join(WORK_DIR, "results.json"), "utf8"));
  const changes = changesOf(results, baseline.files);

  await uploadFolder(join(WORK_DIR, "report"), `${env("REPORT_ID")}/visual/`);
  const url = `${env("SITE_URL")}/reports/${env("REPORT_ID")}/visual/index.html`;
  await status({ ...reviewStatus(changes, files.length), url });
  await writeOutputs({
    "visual-changes": changes.changed.length + changes.added.length,
    "visual-report-url": url,
  });
  console.log(
    `Compared ${files.length} screenshots with main's (report ${baseline.reportId}): ` +
      `${changes.changed.length} changed, ${changes.added.length} new. ${url}`
  );
};

if (import.meta.main) {
  const files = await screenshotsIn(EVIDENCE_DIR);
  if (env("PULL_REQUEST", { optional: true })) {
    await compare(files);
  } else if (env("BRANCH", { optional: true }) === "main") {
    // Only a run whose tests all passed: a failed one's screenshots may show
    // the failure.
    const { stats } = JSON.parse(await readFile("playwright-results.json", "utf8"));
    if (stats.unexpected === 0 && files.length) {
      await saveBaseline(files);
    }
  }
}

export { changesOf, reviewStatus };
