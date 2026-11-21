import { describe, expect, test } from "bun:test";
import { mergeSettings, validSection } from "./settings.js";

describe("validSection", () => {
  test("accepts filters in the right shape", () => {
    expect(
      validSection("filters", {
        powerRanges: ["150-300"],
        connectorTypes: ["ccs", "chademo"],
        updatedAt: 1,
      })
    ).toBe(true);
  });

  test("refuses unknown sections and fields, wrong types and missing times", () => {
    expect(validSection("favourites", { updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: [], extra: 1, updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: "150-300", updatedAt: 1 })).toBe(false);
    expect(validSection("filters", { powerRanges: [] })).toBe(false);
    expect(validSection("filters", null)).toBe(false);
  });
});

describe("mergeSettings", () => {
  test("keeps the newer copy of each section", () => {
    const stored = { filters: { powerRanges: ["300-plus"], updatedAt: 200 } };

    expect(
      mergeSettings(stored, { filters: { powerRanges: ["under-50"], updatedAt: 100 } })
    ).toEqual(stored);
    expect(
      mergeSettings(stored, { filters: { powerRanges: ["under-50"], updatedAt: 300 } })
    ).toEqual({ filters: { powerRanges: ["under-50"], updatedAt: 300 } });
  });

  test("adds sections the account doesn't have yet", () => {
    expect(mergeSettings({}, { filters: { powerRanges: [], updatedAt: 1 } })).toEqual({
      filters: { powerRanges: [], updatedAt: 1 },
    });
  });
});
