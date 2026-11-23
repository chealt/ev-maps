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

// [{ title, screenshots: [{ caption, body }], video }] for every test result
// with UI evidence (@ev-maps/e2e's @ui tag): its "ui" attachments, or
// "ui: {caption}" for the moments the test captured, in the order taken.
const uiResults = async (resultsFile = RESULTS_FILE) => {
  const results = JSON.parse(await readFile(resultsFile, "utf8"));
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const screenshots = (result.attachments ?? [])
            .filter(({ name }) => name === "ui" || name.startsWith("ui: "))
            .map(({ name, body }) => ({ caption: name.slice("ui: ".length) || null, body }));
          if (!screenshots.length) {
            continue;
          }
          found.push({
            title: [...titles, spec.title].join(" › "),
            screenshots,
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

// Writes each result's screenshots and video into EVIDENCE_DIR as
// {slug}.png ({slug}-2.png, …) and {slug}.webm, and returns
// [{ title, pngs: [{ caption, file }], webm }] (webm null without a video).
const materialize = async (resultsFile = RESULTS_FILE, directory = EVIDENCE_DIR) => {
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const result of await uiResults(resultsFile)) {
    const base = slug(result.title);
    const pngs = [];
    for (const [index, { caption, body }] of result.screenshots.entries()) {
      const file = index ? `${base}-${index + 1}.png` : `${base}.png`;
      await writeFile(join(directory, file), Buffer.from(body, "base64"));
      pngs.push({ caption, file });
    }
    let webm = null;
    if (result.video?.path) {
      webm = `${base}.webm`;
      await copyFile(result.video.path, join(directory, webm));
    }
    entries.push({ title: result.title, pngs, webm });
  }
  return entries;
};

// The evidence as markdown: each screenshot the test took, embedded under
// its caption, with links to its video and the report, e.g.
//   **The ? key opens the keyboard shortcuts**
//   ![the dialog open](…/ui/the-key-opens….png)
//   [Video](…/ui/the-key-opens….webm) · [Report](…/reports/123-1/)
const uiEvidenceMarkdown = (entries, fileUrl, reportUrl) =>
  entries
    .map(({ title, pngs, webm }) => {
      const section = [`**${title}**`];
      for (const { caption, file } of pngs) {
        section.push(
          "",
          ...(caption ? [`_${caption}_`, ""] : []),
          `![${caption ?? title}](${fileUrl}${file})`
        );
      }
      const links = [webm && `[Video](${fileUrl}${webm})`, `[Report](${reportUrl})`];
      section.push("", links.filter(Boolean).join(" · "));
      return section.join("\n");
    })
    .join("\n\n");

export { materialize, uiEvidenceMarkdown, uiResults, EVIDENCE_DIR };
