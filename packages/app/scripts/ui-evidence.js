// The UI evidence of a run: the screenshots of tests tagged @ui and their
// videos, as markdown for the pull request comment and the release notes.
// Shared by scripts/publish-test-report.js.
//
// The attachments come from Playwright's JSON summary
// (playwright-results.json): the screenshot ("ui") is inline (base64 body),
// the video a file on disk. materialize() writes both into a directory, so
// they can be uploaded like the report itself and linked where they end up.

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RESULTS_FILE = "playwright-results.json";
const EVIDENCE_DIR = "ui-evidence";

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

// [{ title, screenshot, video }] for every test result with a "ui"
// attachment (@ev-maps/e2e's @ui tag), in the order the summary lists them.
const uiResults = async (resultsFile = RESULTS_FILE) => {
  const results = JSON.parse(await readFile(resultsFile, "utf8"));
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const screenshot = result.attachments?.find((item) => item.name === "ui");
          if (!screenshot) {
            continue;
          }
          found.push({
            title: [...titles, spec.title].join(" › "),
            screenshot,
            video: result.attachments?.find((item) => item.name === "video"),
          });
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
  return found;
};

// Writes each result's screenshot and video into EVIDENCE_DIR as
// {slug}.png and {slug}.webm, and returns [{ title, png, webm }] with the
// file names (and webm null without a video).
const materialize = async (resultsFile = RESULTS_FILE, directory = EVIDENCE_DIR) => {
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const result of await uiResults(resultsFile)) {
    const base = slug(result.title);
    const png = `${base}.png`;
    await writeFile(join(directory, png), Buffer.from(result.screenshot.body, "base64"));
    let webm = null;
    if (result.video?.path) {
      webm = `${base}.webm`;
      await copyFile(result.video.path, join(directory, webm));
    }
    entries.push({ title: result.title, png, webm });
  }
  return entries;
};

// The evidence as markdown: the screenshot embedded, linking to the report
// it came from, and the video linked next to it, e.g.
//   [![The ? key opens the keyboard shortcuts](…/ui/screenshot.png)](…/reports/123-1/)
//   [Watch the video](…/ui/screenshot.webm)
const uiEvidenceMarkdown = (entries, fileUrl, reportUrl) =>
  entries
    .map(({ title, png, webm }) => {
      const section = [`[![${title}](${fileUrl}${png})](${reportUrl})`];
      if (webm) {
        section.push("", `[Watch the video](${fileUrl}${webm})`);
      }
      return section.join("\n");
    })
    .join("\n\n");

export { materialize, uiEvidenceMarkdown, uiResults, EVIDENCE_DIR };
