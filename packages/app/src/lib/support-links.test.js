import { describe, expect, test } from "bun:test";
import { SUPPORT_LINKS, supportLinks } from "./support-links.js";

describe("supportLinks", () => {
  const allEnabled = SUPPORT_LINKS.map((link) => ({ ...link, enabled: true }));

  test("lists the enabled options, the language's own first", () => {
    expect(supportLinks("pl", allEnabled).map(({ id }) => id)).toEqual([
      "buycoffee",
      "github-sponsors",
      "ko-fi",
    ]);
    expect(supportLinks("en", allEnabled).map(({ id }) => id)).toEqual([
      "github-sponsors",
      "ko-fi",
      "buycoffee",
    ]);
  });

  test("leaves out the disabled options", () => {
    const links = allEnabled.map((link) => ({ ...link, enabled: link.id === "ko-fi" }));
    expect(supportLinks("pl", links).map(({ id }) => id)).toEqual(["ko-fi"]);
    expect(
      supportLinks(
        "en",
        allEnabled.map((link) => ({ ...link, enabled: false }))
      )
    ).toEqual([]);
  });

  test("links to https pages", () => {
    for (const { url } of SUPPORT_LINKS) {
      expect(new URL(url).protocol).toBe("https:");
    }
  });
});
