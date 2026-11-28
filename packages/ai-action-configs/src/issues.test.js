import { describe, expect, test } from "bun:test";
import { findingsErrors, issueBodyOf, newFindings } from "./issues.js";

const finding = (title) => ({ title, body: `About ${title}` });

describe("findingsErrors", () => {
  test("accepts findings with a title and a body, and none", () => {
    expect(findingsErrors([finding("A secret in the code")])).toEqual([]);
    expect(findingsErrors([])).toEqual([]);
  });

  test("says what's missing", () => {
    expect(findingsErrors({})).toEqual(["The findings must be an array"]);
    expect(findingsErrors([{ title: "A", body: " " }, null])).toEqual([
      "Finding 1: body is required",
      "Finding 2: title is required",
      "Finding 2: body is required",
    ]);
  });
});

describe("newFindings", () => {
  test("leaves out the ones an issue has the title of, whatever the case and spacing", () => {
    const findings = [finding("SQL injection in /stations"), finding("A secret in the code")];
    expect(newFindings(findings, ["sql  injection in /stations "])).toEqual([findings[1]]);
  });

  test("files a title once", () => {
    expect(newFindings([finding("A"), finding("a")], [])).toEqual([finding("A")]);
  });
});

describe("issueBodyOf", () => {
  test("ends with who found it", () => {
    expect(issueBodyOf(finding("A"), "Found by pi")).toBe(
      "About A\n\n---\n\n<sub>Found by pi</sub>\n"
    );
    expect(issueBodyOf(finding("A"))).toBe("About A\n");
  });
});
