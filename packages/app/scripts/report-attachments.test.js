import { describe, expect, test } from "bun:test";
import { attachmentsNamed } from "./report-attachments.js";

const vitals = (ttfb) => ({
  name: "web-vitals",
  body: Buffer.from(JSON.stringify({ url: "/en/", TTFB: ttfb })).toString("base64"),
});

// A test whose first attempt failed (slow, the server still compiling) and
// whose retry passed.
const results = {
  suites: [
    {
      title: "google-map.spec.js",
      specs: [
        {
          title: "opens the map",
          file: "google-map.spec.js",
          tests: [
            {
              results: [
                { status: "failed", attachments: [vitals(3717)] },
                { status: "passed", attachments: [vitals(186)] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("attachmentsNamed", () => {
  test("every attempt's attachments, by default", () => {
    expect(attachmentsNamed(results, "web-vitals").map(({ value }) => value.TTFB)).toEqual([
      3717, 186,
    ]);
  });

  test("only the final attempt's, when asked", () => {
    expect(
      attachmentsNamed(results, "web-vitals", { finalAttempt: true }).map(({ value }) => value.TTFB)
    ).toEqual([186]);
  });
});
