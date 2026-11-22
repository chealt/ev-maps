// Comments the UI evidence on the pull request: the screenshots and videos
// of its @ui tests, embedded from its own preview deployment (where the
// public /reports/{id}/ui/ route of scripts/ui-evidence.js's upload already
// runs), each screenshot linking to the report it came from. Replaces the
// comment an earlier run of the pull request left.
//
//   bun scripts/pr-ui-evidence-comment.js
//
// From the environment: GITHUB_TOKEN and GITHUB_REPOSITORY; PULL_REQUEST;
// UI_FILES (the entries scripts/publish-test-report.js output, as JSON);
// DEPLOY_URL (the pull request's preview deployment) and REPORT_URL.

import { uiEvidenceMarkdown } from "./ui-evidence.js";

const env = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} isn't set`);
  }
  return value;
};

const headers = {
  authorization: `Bearer ${env("GITHUB_TOKEN")}`,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
};

const github = async (path, init) => {
  const response = await fetch(`https://api.github.com/repos/${env("GITHUB_REPOSITORY")}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

const reportId = new RegExp("/reports/(\\d+-\\d+)/").exec(env("REPORT_URL"))?.[1];
const body = `<!-- ui-evidence -->\n## UI evidence\n\n${uiEvidenceMarkdown(
  JSON.parse(env("UI_FILES")),
  `${env("DEPLOY_URL")}/reports/${reportId}/ui/`,
  env("REPORT_URL")
)}`;

const comments = await github(`/issues/${env("PULL_REQUEST")}/comments`, {});
const own = comments.find((comment) => comment.body.includes("<!-- ui-evidence -->"));
await github(own ? `/issues/comments/${own.id}` : `/issues/${env("PULL_REQUEST")}/comments`, {
  method: own ? "PATCH" : "POST",
  body: JSON.stringify({ body }),
});
console.log(`Commented the UI evidence on pull request ${env("PULL_REQUEST")}`);
