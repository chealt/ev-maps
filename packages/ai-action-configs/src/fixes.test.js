import { describe, expect, test } from "bun:test";
import {
  branchOf,
  duplicatesPromptOf,
  findingsToFix,
  fixFindingsErrors,
  fixPromptOf,
  parseDuplicates,
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
    const body = pullRequestBodyOf(finding("a"), "Fixed it.\n");
    expect(body.startsWith("Fixed it.\n\n<details>")).toBe(true);
    expect(body).toContain("Body of a");
    expect(body).not.toContain("pi (");
    expect(body).toEndWith("</details>\n");
  });
});

describe("duplicatesPromptOf and parseDuplicates", () => {
  const findings = [finding("a"), finding("b")];
  const open = [
    { number: 12, title: "Lock down CORS", headRefName: "fix/cors", body: "Only our origin" },
  ];

  test("give pi the findings and the open pull requests", () => {
    const prompt = duplicatesPromptOf(findings, open);
    expect(prompt).toContain("## a: About a");
    expect(prompt).toContain("## #12 Lock down CORS (fix/cors)");
    expect(prompt).toContain("Only our origin");
    expect(duplicatesPromptOf(findings, [])).toContain("None.");
  });

  test("read the ids pi says are fixed, from its answer's JSON", () => {
    expect([...parseDuplicates('Checked.\n{"a": 12}', findings, open)]).toEqual([["a", 12]]);
    expect([...parseDuplicates('{"b": "12"}', findings, open)]).toEqual([["b", 12]]);
  });

  test("ignore unknown ids, pull requests that aren't open, and answers that aren't JSON", () => {
    expect(parseDuplicates('{"z": 12, "a": 99}', findings, open).size).toBe(0);
    expect(parseDuplicates("No idea", findings, open).size).toBe(0);
    expect(parseDuplicates("[1]", findings, open).size).toBe(0);
  });
});
