// Picks the next issue the "AI: implement issues" workflow works on,
// without AI: the open issues no one is working on, by Priority (Urgent,
// High, Medium, Low, then none) and oldest first, as CONTRIBUTING.md's
// "Picking Up Issues" says.
//
// An issue is skipped when it's being worked on: an open pull request
// closes or mentions it, it's assigned, its Status (issue field or
// project) is In Progress or Done, or a label says it's in progress. A
// parent with open sub-issues waits for them: they're picked up first.
//
// Usage: bun scripts/pick-issue.js [owner/repo]
// Prints the issue's number (nothing if there's none), and writes
// `number=` and `title=` to $GITHUB_OUTPUT when it's set.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const PRIORITIES = ["Urgent", "High", "Medium", "Low"];
const BUSY_STATUS = /^(in progress|in review|done)$/i;
const BUSY_LABEL = /^(in progress|wip|blocked)$/i;

const priorityOf = (issue) => {
  const name = (issue.issue_field_values ?? []).find(
    (field) => field.issue_field_name === "Priority"
  )?.single_select_option?.name;
  const rank = PRIORITIES.indexOf(name);
  return rank === -1 ? PRIORITIES.length : rank;
};

const statusesOf = (issue) => [
  ...(issue.issue_field_values ?? [])
    .filter((field) => field.issue_field_name === "Status")
    .map((field) => field.single_select_option?.name),
  ...(issue.projectStatuses ?? []),
];

// The issue numbers an open pull request works on: those it closes, and
// those its title, body or branch mention (#12, issue-12).
const issuesOfPullRequest = ({ title = "", body = "", headRefName = "", closes = [] }) => {
  const numbers = new Set(closes);
  for (const match of `${title}\n${body ?? ""}`.matchAll(/#(\d+)\b/g)) {
    numbers.add(Number(match[1]));
  }
  const branch = /(?:^|\/)(?:issue-)?(\d+)(?:-|$)/.exec(headRefName);
  if (branch) {
    numbers.add(Number(branch[1]));
  }
  return numbers;
};

const isFree = (issue, claimed) => {
  if (issue.pull_request || claimed.has(issue.number)) {
    return false;
  }
  if ((issue.assignees ?? []).length > 0) {
    return false;
  }
  if ((issue.labels ?? []).some((label) => BUSY_LABEL.test(label.name ?? label))) {
    return false;
  }
  if (statusesOf(issue).some((status) => BUSY_STATUS.test(status ?? ""))) {
    return false;
  }
  const sub = issue.sub_issues_summary;
  return !(sub && sub.total > sub.completed);
};

const pickIssue = (issues, pullRequests) => {
  const claimed = new Set(pullRequests.flatMap((pr) => [...issuesOfPullRequest(pr)]));
  return (
    issues
      .filter((issue) => isFree(issue, claimed))
      .toSorted((a, b) => priorityOf(a) - priorityOf(b) || a.number - b.number)[0] ?? null
  );
};

const gh = (args, quiet = false) =>
  JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
    })
  );

// The project Status needs read:project; without it, it's left out.
const projectStatuses = (owner, name) => {
  try {
    const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
      issues(states: OPEN, first: 100) { nodes { number projectItems(first: 10) { nodes {
        fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      } } } } } }`;
    const data = gh(
      ["api", "graphql", "-f", `query=${query}`, "-F", `owner=${owner}`, "-F", `name=${name}`],
      true
    );
    return new Map(
      data.data.repository.issues.nodes.map((node) => [
        node.number,
        node.projectItems.nodes.map((item) => item.fieldValueByName?.name).filter(Boolean),
      ])
    );
  } catch {
    return new Map();
  }
};

const main = (repo) => {
  const [owner, name] = repo.split("/");
  const issues = gh([
    "api",
    "--paginate",
    "--slurp",
    `repos/${repo}/issues?state=open&per_page=100`,
  ]).flat();
  const statuses = projectStatuses(owner, name);
  for (const issue of issues) {
    issue.projectStatuses = statuses.get(issue.number) ?? [];
  }
  const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: 100) { nodes { title body headRefName
      closingIssuesReferences(first: 20) { nodes { number } } } } } }`;
  const pullRequests = gh([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
  ]).data.repository.pullRequests.nodes.map((pr) => ({
    ...pr,
    closes: pr.closingIssuesReferences.nodes.map((issue) => issue.number),
  }));
  const issue = pickIssue(issues, pullRequests);
  if (!issue) {
    return;
  }
  console.log(issue.number);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `number=${issue.number}\ntitle=${issue.title.replaceAll("\n", " ")}\n`
    );
  }
};

if (import.meta.main) {
  main(process.argv[2] ?? process.env.GITHUB_REPOSITORY ?? "chealt/ev-maps");
}

export { issuesOfPullRequest, pickIssue, priorityOf };
