import { describe, expect, test } from "bun:test";
import { SUPPORT_LINKS, supportLinks } from "./support-links.js";

describe("supportLinks", () => {
  test("lists every option, the language's own first", () => {
    expect(supportLinks("pl").map(({ id }) => id)).toEqual([
      "buycoffee",
      "github-sponsors",
      "ko-fi",
    ]);
    expect(supportLinks("en").map(({ id }) => id)).toEqual([
      "github-sponsors",
      "ko-fi",
      "buycoffee",
    ]);
  });

  test("links to https pages", () => {
    for (const { url } of SUPPORT_LINKS) {
      expect(new URL(url).protocol).toBe("https:");
    }
  });
});
