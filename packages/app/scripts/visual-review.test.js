import { describe, expect, test } from "bun:test";
import { reviewStatus, visualChanges } from "./visual-review.js";

const results = {
  suites: [
    {
      title: "google-map.spec.js",
      specs: [
        {
          title: "shows charger details",
          tests: [
            {
              results: [
                // A retry's annotations count, not the failed attempt's.
                { annotations: [{ type: "visual-change", description: "changed: old.png" }] },
                {
                  annotations: [
                    { type: "visual-change", description: "changed: details.png" },
                    { type: "other", description: "not a visual change" },
                  ],
                },
              ],
            },
          ],
        },
        {
          title: "a new dialog",
          tests: [
            {
              results: [
                { annotations: [{ type: "visual-change", description: "new: dialog.png" }] },
              ],
            },
          ],
        },
        { title: "unchanged", tests: [{ results: [{ annotations: [] }] }] },
      ],
    },
  ],
};

describe("visualChanges", () => {
  test("lists the screenshots that changed or are new, from each test's last attempt", () => {
    expect(visualChanges(results)).toEqual([
      { test: "shows charger details", change: "changed", screenshot: "details.png" },
      { test: "a new dialog", change: "new", screenshot: "dialog.png" },
    ]);
  });
});

describe("reviewStatus", () => {
  test("passes when nothing changed", () => {
    expect(reviewStatus([])).toEqual({ state: "success", description: "No visual changes" });
  });

  test("waits for an approval when something changed or is new", () => {
    expect(reviewStatus(visualChanges(results))).toEqual({
      state: "pending",
      description: "1 changed, 1 new: approve the visual changes (Visual approval job)",
    });
  });
});
