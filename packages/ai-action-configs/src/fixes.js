// What scripts/fix-findings.js fixes: the findings an AI action wrote, minus
// the ones an open pull request is fixing already (#450).
//
// A finding: { "id": "cors-wildcard-worker", "title": "…", "body": "…" }.
// The id, the same each time the problem is found, names the fix's branch,
// ai/{config}/{id}, and the pull request's title is "{prefix}: {title}". A
// finding has a pull request when an open one has its branch or its title;
// one closed without merging doesn't count, so the next run tries again.

import { findingsErrors } from "./issues.js";

const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

const normalise = (title) => title.trim().replace(/\s+/g, " ").toLowerCase();

// The findings' problems, as messages; none if they're valid.
const fixFindingsErrors = (findings) => {
  const errors = findingsErrors(findings);
  if (!Array.isArray(findings)) {
    return errors;
  }
  return [
    ...errors,
    ...findings.flatMap((finding, index) =>
      ID.test(finding?.id ?? "")
        ? []
        : [`Finding ${index + 1}: id must be lowercase letters, digits and dashes`]
    ),
  ];
};

const branchOf = (name, finding) => `ai/${name}/${finding.id}`;

const titleOf = (prefix, finding) => `${prefix}: ${finding.title.trim()}`;

// The findings to fix: none an open pull request (its headRefName and title)
// fixes, each id once, at most `limit`.
const findingsToFix = (findings, openPullRequests, { name, prefix, limit }) => {
  const branches = new Set(openPullRequests.map(({ headRefName }) => headRefName));
  const titles = new Set(openPullRequests.map(({ title }) => normalise(title)));
  const seen = new Set();
  return findings
    .filter((finding) => {
      if (seen.has(finding.id)) {
        return false;
      }
      seen.add(finding.id);
      return (
        !branches.has(branchOf(name, finding)) && !titles.has(normalise(titleOf(prefix, finding)))
      );
    })
    .slice(0, limit);
};

// The prompt that has pi fix one finding.
const fixPromptOf = (finding) =>
  "Fix this problem a security audit found in this repository, and only it:\n\n" +
  `# ${finding.title.trim()}\n\n${finding.body.trim()}\n\n` +
  "Keep the change as small as the fix allows, follow the repository's guidelines, add or " +
  "update the tests of what you change, and run them, the lint and the format check. " +
  "Don't commit. If it isn't a real problem or you can't fix it safely, change nothing. " +
  "Your final message becomes the description of the pull request with your fix, so write " +
  "it in Markdown for its reviewer: the problem, what you changed and why, and how you " +
  "checked it; if you changed nothing, say why.";

// The pull request's description: pi's report, the finding, who made it.
const pullRequestBodyOf = (finding, report, footer) =>
  `${report.trim()}\n\n<details><summary>The finding</summary>\n\n${finding.body.trim()}\n\n</details>\n` +
  (footer ? `\n---\n\n<sub>${footer}</sub>\n` : "");

export { branchOf, findingsToFix, fixFindingsErrors, fixPromptOf, pullRequestBodyOf, titleOf };
