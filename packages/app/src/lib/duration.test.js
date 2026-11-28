import { beforeAll, describe, expect, test } from "bun:test";

// The page's language, which formatNumber reads.
globalThis.document ??= { documentElement: { lang: "en" } };

let formatDuration;
beforeAll(async () => {
  ({ formatDuration } = await import("./duration.js"));
});

describe("formatDuration", () => {
  test("in minutes under an hour, at least one", () => {
    expect(formatDuration(45 * 60000)).toBe("45 min");
    expect(formatDuration(10000)).toBe("1 min");
  });

  test("in hours and minutes", () => {
    expect(formatDuration((2 * 60 + 5) * 60000)).toBe("2 hr 5 min");
    expect(formatDuration(3 * 3600000 + 10000)).toBe("3 hr");
  });
});
