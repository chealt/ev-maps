// The visual review of a pull request (#309, docs/CI.md): after
// scripts/publish-test-report.js, from the published HTML report. captureUi
// marks each @ui moment that differs from main's, or that main doesn't have,
// with a "visual-change" annotation, and Playwright attaches the expected,
// actual and diff images to the test. This
// - sets the "Visual review" commit status: green when nothing changed,
//   pending (until the App workflow's Visual approval job is approved by a
//   person) when something did;
// - comments the changes on the pull request: main's screenshot and the
//   pull request's side by side, with the diff, and a link to the test in
//   the report. The images are published in the report's public ui/ folder.
//   A later run without changes updates the comment to say so.
//
//   bun scripts/visual-review.js
//
// From the environment: report-storage.js's R2 and GitHub settings, and
// REPORT_ID, COMMIT_SHA, PULL_REQUEST and SITE_URL.

import { appendFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { reportTests } from "./html-report.js";
import { env, postCommitStatus, uploadFolder } from "./report-storage.js";

const REPORT_DIR = "playwright-report";
const IMAGES_DIR = "visual-changes";
const STATUS_CONTEXT = "Visual review";
const MARKER = "<!-- visual-review -->";

// As captureUi names a moment's screenshot (packages/e2e/src/test.js).
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

const annotationsOf = (test) => {
  // The last attempt's; older reports keep them on the test.
  const last = test.results.at(-1);
  const annotations = last?.annotations?.length ? last.annotations : (test.annotations ?? []);
  return annotations.filter(({ type }) => type === "visual-change");
};

// [{ test, testId, change: "changed" | "new", screenshot, images }] from the
// report's tests, images being { expected, actual, diff } paths in the
// report for a changed screenshot (Playwright's, in the order the moments
// were compared), and { actual } for a new one (its UI evidence screenshot).
const visualChanges = (tests) => {
  const changes = [];
  for (const test of tests) {
    const annotations = annotationsOf(test);
    if (!annotations.length) {
      continue;
    }
    const attachments = test.results.at(-1)?.attachments ?? [];
    const named = (suffix) => attachments.filter(({ name }) => name.endsWith(suffix));
    const [expected, actual, diff] = ["-expected.png", "-actual.png", "-diff.png"].map(named);
    const evidence = attachments.filter(({ name }) => name === "ui" || name.startsWith("ui: "));
    let compared = 0;
    for (const { description } of annotations) {
      const [change, screenshot] = description.split(": ");
      let images;
      if (change === "changed") {
        images = {
          expected: expected[compared]?.path,
          actual: actual[compared]?.path,
          diff: diff[compared]?.path,
        };
        compared++;
      } else {
        const moment = evidence.find(
          ({ name }) =>
            `${slug([test.title.split(" › ").at(-1), name.slice("ui: ".length)].filter(Boolean).join(" "))}.png` ===
            screenshot
        );
        images = { actual: (moment ?? evidence[0])?.path };
      }
      changes.push({ test: test.title, testId: test.testId, change, screenshot, images });
    }
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

// The published images' names (only [\w-] in the public ui/ folder).
const imageName = (change, kind) =>
  `visual--${change.screenshot.replace(/\.png$/, "").replace(/[^\w-]/g, "-")}-${kind}.png`;

// The comment: each change with main's screenshot and the pull request's
// side by side (the diff under them), and a link to its test in the report.
const commentMarkdown = (changes, imagesUrl, reportUrl) => {
  if (!changes.length) {
    return `${MARKER}\n## Visual review\n\nNo visual changes compared with \`main\` anymore.\n`;
  }
  const image = (change, kind, alt) =>
    change.images[kind]
      ? `<img src="${imagesUrl}${imageName(change, kind)}" alt="${alt}" width="400">`
      : "";
  const sections = changes.map((change) => {
    const link = `[${change.test}](${reportUrl}#?testId=${change.testId})`;
    if (change.change === "new") {
      return `### New: \`${change.screenshot}\`\n\n${link}\n\n${image(change, "actual", "This pull request")}\n`;
    }
    return [
      `### Changed: \`${change.screenshot}\``,
      "",
      link,
      "",
      "| `main` | This pull request |",
      "| --- | --- |",
      `| ${image(change, "expected", "main")} | ${image(change, "actual", "This pull request")} |`,
      "",
      `<details><summary>Diff</summary>\n\n${image(change, "diff", "Diff")}\n\n</details>`,
      "",
    ].join("\n");
  });
  return [
    MARKER,
    "## Visual review",
    "",
    `${reviewStatus(changes).description.split(":")[0]} compared with \`main\`. If they're intended, approve them: **Review deployments** on the run's Visual approval job.`,
    "",
    ...sections,
  ].join("\n");
};

const github = async (path, init = {}) => {
  const response = await fetch(`https://api.github.com/repos/${env("GITHUB_REPOSITORY")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

// The pull request's visual review comment: written when there are changes,
// updated when there no longer are.
const comment = async (body, hasChanges) => {
  const pullRequest = env("PULL_REQUEST");
  const comments = await github(`/issues/${pullRequest}/comments?per_page=100`);
  const own = comments.find((each) => each.body.includes(MARKER));
  if (!own && !hasChanges) {
    return;
  }
  await github(own ? `/issues/comments/${own.id}` : `/issues/${pullRequest}/comments`, {
    method: own ? "PATCH" : "POST",
    body: JSON.stringify({ body }),
  });
};

if (import.meta.main) {
  const changes = visualChanges(await reportTests(REPORT_DIR));
  const reportUrl = `${env("SITE_URL")}/en/admin/reports/${env("REPORT_ID")}/`;
  await postCommitStatus(env("COMMIT_SHA"), {
    context: STATUS_CONTEXT,
    url: reportUrl,
    ...reviewStatus(changes),
  });
  if (changes.length) {
    await mkdir(IMAGES_DIR, { recursive: true });
    for (const change of changes) {
      for (const [kind, path] of Object.entries(change.images)) {
        if (path) {
          await copyFile(join(REPORT_DIR, path), join(IMAGES_DIR, imageName(change, kind)));
        }
      }
    }
    await uploadFolder(IMAGES_DIR, `${env("REPORT_ID")}/ui/`);
  }
  await comment(
    commentMarkdown(changes, `${env("SITE_URL")}/reports/${env("REPORT_ID")}/ui/`, reportUrl),
    changes.length > 0
  );
  for (const { test, change, screenshot } of changes) {
    console.log(`${change}: ${screenshot} (${test})`);
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `visual-changes=${changes.length}\nvisual-report-url=${reportUrl}\n`
    );
  }
}

export { commentMarkdown, imageName, reviewStatus, visualChanges };
