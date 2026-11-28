import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// The page's language, which formatNumber reads; put back after, as the
// other test files share the global.
const realDocument = globalThis.document;
globalThis.document ??= { documentElement: { lang: "en" } };
afterAll(() => {
  if (realDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = realDocument;
  }
});

let formatDistance;
let localeUnit;
beforeAll(async () => {
  ({ formatDistance } = await import("./distance.js"));
  ({ localeUnit } = await import("./distance-unit.js"));
});

describe("formatDistance", () => {
  test("in kilometres, metres when short", () => {
    expect(formatDistance(347, "metric")).toBe("350 m");
    expect(formatDistance(4230, "metric")).toBe("4.2 km");
    expect(formatDistance(35_400, "metric")).toBe("35 km");
  });

  test("in miles, feet when short", () => {
    expect(formatDistance(150, "imperial")).toBe("490 ft");
    expect(formatDistance(4230, "imperial")).toBe("2.6 mi");
    expect(formatDistance(35_400, "imperial")).toBe("22 mi");
  });
});

describe("localeUnit", () => {
  test("is miles where people drive in miles", () => {
    for (const language of ["en-US", "en-GB", "en", "my-MM"]) {
      expect(localeUnit(language)).toBe("imperial");
    }
  });

  test("is kilometres elsewhere", () => {
    for (const language of ["hu-HU", "pl", "de-DE", "en-IE", "en-AU", "fr-CA"]) {
      expect(localeUnit(language)).toBe("metric");
    }
  });

  test("is kilometres for what isn't a locale", () => {
    expect(localeUnit("not a locale!")).toBe("metric");
  });
});
