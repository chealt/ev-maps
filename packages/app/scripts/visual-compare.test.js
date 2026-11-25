import { describe, expect, test } from "bun:test";
import { changesOf, reviewStatus } from "./visual-compare.js";

const results = (outcomes) => ({
  suites: [
    {
      title: "compare.visual.js",
      specs: Object.entries(outcomes).map(([title, status]) => ({
        title,
        tests: [{ results: [{ status }] }],
      })),
    },
  ],
});

describe("changesOf", () => {
  test("tells the changed screenshots from the new ones", () => {
    const changes = changesOf(
      results({ "same.png": "passed", "moved.png": "failed", "brand-new.png": "failed" }),
      ["same.png", "moved.png"]
    );
    expect(changes).toEqual({ changed: ["moved.png"], added: ["brand-new.png"] });
  });
});

describe("reviewStatus", () => {
  test("passes when nothing changed", () => {
    expect(reviewStatus({ changed: [], added: [] }, 12)).toEqual({
      state: "success",
      description: "No visual changes in 12 screenshots",
    });
  });

  test("waits for an approval when something changed or is new", () => {
    expect(reviewStatus({ changed: ["a.png", "b.png"], added: ["c.png"] }, 12)).toEqual({
      state: "pending",
      description: "2 changed, 1 new: approve the visual changes (Visual approval job)",
    });
  });
});
