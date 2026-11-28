import { describe, expect, test } from "bun:test";
import {
  branchOf,
  findingsToFix,
  fixFindingsErrors,
  fixPromptOf,
  pullRequestBodyOf,
  titleOf,
} from "./fixes.js";

const finding = (id, title = `About ${id}`) => ({ id, title, body: `Body of ${id}` });
const options = { name: "security-audit", prefix: "Security", limit: 3 };

describe("fixFindingsErrors", () => {
  test("accepts findings with an id, a title and a body", () => {
    expect(fixFindingsErrors([finding("cors-wildcard")])).toEqual([]);
    expect(fixFindingsErrors([])).toEqual([]);
  });

  test("says what's missing or wrong", () => {
    expect(fixFindingsErrors({})).toEqual(["The findings must be an array"]);
    expect(fixFindingsErrors([{ id: "Bad id", title: "A", body: "B" }])).toEqual([
      "Finding 1: id must be lowercase letters, digits and dashes",
    ]);
  });
});

describe("branchOf and titleOf", () => {
  test("name the finding's pull request", () => {
    expect(branchOf("security-audit", finding("cors-wildcard"))).toBe(
      "ai/security-audit/cors-wildcard"
    );
    expect(titleOf("Security", finding("x", " CORS allows any origin "))).toBe(
      "Security: CORS allows any origin"
    );
  });
});

describe("findingsToFix", () => {
  test("skips a finding an open pull request has the branch or title of", () => {
    const findings = [finding("a"), finding("b", "B problem"), finding("c")];
    const open = [
      { headRefName: "ai/security-audit/a", title: "Something else" },
      { headRefName: "someone/branch", title: "security:  b PROBLEM" },
    ];
    expect(findingsToFix(findings, open, options).map(({ id }) => id)).toEqual(["c"]);
  });

  test("fixes each id once, at most the limit", () => {
    const findings = ["a", "a", "b", "c", "d"].map((id) => finding(id));
    expect(findingsToFix(findings, [], options).map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});

describe("fixPromptOf and pullRequestBodyOf", () => {
  test("carry the finding", () => {
    expect(fixPromptOf(finding("a"))).toContain("# About a\n\nBody of a");
    const body = pullRequestBodyOf(finding("a"), "Fixed it.\n", "Made by pi");
    expect(body.startsWith("Fixed it.\n\n<details>")).toBe(true);
    expect(body).toContain("Body of a");
    expect(body).toEndWith("<sub>Made by pi</sub>\n");
  });
});
