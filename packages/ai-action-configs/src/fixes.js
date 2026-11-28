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

// The prompt that has pi tell which findings an open pull request fixes
// already, by what it changes rather than its name: findings reworded since,
// or a fix someone opened by hand. Each pull request with its number, title,
// branch and the start of its description.
const duplicatesPromptOf = (findings, openPullRequests) =>
  "A security audit found the problems below. Decide which of them an open pull request " +
  "of this repository already fixes, by what the pull request says it changes, not by its " +
  "wording: the same problem in the same place counts, a related one doesn't. You may read " +
  "the repository and run `gh pr view` or `gh pr diff` to check, but change nothing. Reply " +
  "with only a JSON object mapping each such problem's id to the pull request's number, e.g. {\"cors-wildcard-worker\": 123}, " +
  "and {} if none is fixed already.\n\n# Problems\n\n" +
  findings
    .map(({ id, title, body }) => `## ${id}: ${title.trim()}\n\n${body.trim().slice(0, 1500)}`)
    .join("\n\n") +
  "\n\n# Open pull requests\n\n" +
  (openPullRequests.length
    ? openPullRequests
        .map(
          ({ number, title, headRefName, body = "" }) =>
            `## #${number} ${title} (${headRefName})\n\n${body.trim().slice(0, 800)}`
        )
        .join("\n\n")
    : "None.");

// pi's answer to duplicatesPromptOf: the ids it says an open pull request
// fixes, mapped to that pull request's number. Only known ids and open
// numbers count; an answer that isn't a JSON object counts as none.
const parseDuplicates = (answer, findings, openPullRequests) => {
  const match = answer.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(match?.[0] ?? "");
  } catch {
    return new Map();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return new Map();
  }
  const ids = new Set(findings.map(({ id }) => id));
  const numbers = new Set(openPullRequests.map(({ number }) => number));
  return new Map(
    Object.entries(parsed)
      .map(([id, number]) => [id, Number(number)])
      .filter(([id, number]) => ids.has(id) && numbers.has(number))
  );
};

// The pull request's description: pi's report and the finding.
const pullRequestBodyOf = (finding, report) =>
  `${report.trim()}\n\n<details><summary>The finding</summary>\n\n${finding.body.trim()}\n\n</details>\n`;

export {
  branchOf,
  duplicatesPromptOf,
  findingsToFix,
  fixFindingsErrors,
  fixPromptOf,
  parseDuplicates,
  pullRequestBodyOf,
  titleOf,
};
