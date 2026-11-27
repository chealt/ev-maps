import { describe, expect, test } from "bun:test";
import { issuesOfPullRequest, pickIssue } from "./pick-issue.js";

const issue = (number, fields = {}) => ({
  number,
  title: `#${number}`,
  labels: [],
  assignees: [],
  ...fields,
});
const priority = (name) => ({
  issue_field_values: [{ issue_field_name: "Priority", single_select_option: { name } }],
});

describe("pickIssue", () => {
  test("takes the highest priority first, then the oldest", () => {
    const issues = [
      issue(5),
      issue(9, priority("Low")),
      issue(7, priority("High")),
      issue(3, priority("High")),
    ];
    expect(pickIssue(issues, [])?.number).toBe(3);
    expect(pickIssue([issue(5), issue(2)], [])?.number).toBe(2);
  });

  test("skips issues being worked on", () => {
    const busy = [
      issue(1, { assignees: [{ login: "a" }] }),
      issue(2, { labels: [{ name: "In progress" }] }),
      issue(3, {
        issue_field_values: [
          { issue_field_name: "Status", single_select_option: { name: "In Progress" } },
        ],
      }),
      issue(4, { projectStatuses: ["In progress"] }),
      issue(5, { sub_issues_summary: { total: 2, completed: 1 } }),
      issue(6, { pull_request: {} }),
      issue(7),
      issue(8),
    ];
    const pullRequests = [{ title: "feat: x", body: "", headRefName: "feat/x", closes: [7] }];
    expect(pickIssue(busy, pullRequests)?.number).toBe(8);
    expect(pickIssue(busy.slice(0, 6), [])).toBeNull();
  });

  test("picks a parent whose sub-issues are done", () => {
    expect(
      pickIssue([issue(1, { sub_issues_summary: { total: 2, completed: 2 } })], [])?.number
    ).toBe(1);
  });
});

describe("issuesOfPullRequest", () => {
  test("reads the closed and mentioned issues and the branch", () => {
    const numbers = issuesOfPullRequest({
      title: "fix: y (#12)",
      body: "Closes #14",
      headRefName: "ai/issue-21",
      closes: [30],
    });
    expect([...numbers].toSorted((a, b) => a - b)).toEqual([12, 14, 21, 30]);
  });
});
