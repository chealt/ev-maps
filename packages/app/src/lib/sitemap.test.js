import { describe, expect, test } from "bun:test";
import { pageUrl, sitemapXml } from "./sitemap.js";

const SITE = "https://ev.chealt.com";

describe("sitemapXml", () => {
  const xml = sitemapXml(SITE, ["en", "hu"], ["", "hu/"]);

  test("lists every page in every language", () => {
    expect(xml.match(/<loc>/g)).toHaveLength(4);
    for (const url of ["/en/", "/hu/", "/en/hu/", "/hu/hu/"]) {
      expect(xml).toContain(`<loc>${SITE}${url}</loc>`);
    }
  });

  test("gives each page its languages and English as the default", () => {
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="hu" href="${SITE}/hu/hu/"/>`);
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en/hu/"/>`
    );
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe("pageUrl", () => {
  test("is the page's absolute URL", () => {
    expect(pageUrl(SITE, "pl", "privacy/")).toBe(`${SITE}/pl/privacy/`);
  });
});
