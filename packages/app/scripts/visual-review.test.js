import { describe, expect, test } from "bun:test";
import { commentMarkdown, imageName, reviewStatus, visualChanges } from "./visual-review.js";

const tests = [
  {
    testId: "abc",
    title: "google-map.spec.js › shows charger details",
    annotations: [],
    results: [
      // A retry's attempt counts, not the failed one's.
      {
        annotations: [{ type: "visual-change", description: "changed: old.png" }],
        attachments: [],
      },
      {
        annotations: [
          { type: "visual-change", description: "changed: shows-charger-details-the-details.png" },
          { type: "other", description: "not a visual change" },
        ],
        attachments: [
          { name: "ui: the details", path: "data/ui.png" },
          { name: "shows-charger-detai-1-expected.png", path: "data/e.png" },
          { name: "shows-charger-detai-1-actual.png", path: "data/a.png" },
          { name: "shows-charger-detai-1-diff.png", path: "data/d.png" },
        ],
      },
    ],
  },
  {
    testId: "def",
    title: "a new dialog",
    annotations: [],
    results: [
      {
        annotations: [{ type: "visual-change", description: "new: a-new-dialog-open.png" }],
        attachments: [
          { name: "ui: something else", path: "data/x.png" },
          { name: "ui: open", path: "data/open.png" },
        ],
      },
    ],
  },
  {
    testId: "ghi",
    title: "unchanged",
    annotations: [],
    results: [{ annotations: [], attachments: [] }],
  },
];

describe("visualChanges", () => {
  test("pairs each change with its images, from each test's last attempt", () => {
    expect(visualChanges(tests)).toEqual([
      {
        test: "google-map.spec.js › shows charger details",
        testId: "abc",
        change: "changed",
        screenshot: "shows-charger-details-the-details.png",
        images: { expected: "data/e.png", actual: "data/a.png", diff: "data/d.png" },
      },
      {
        test: "a new dialog",
        testId: "def",
        change: "new",
        screenshot: "a-new-dialog-open.png",
        images: { actual: "data/open.png" },
      },
    ]);
  });
});

describe("reviewStatus", () => {
  test("passes when nothing changed", () => {
    expect(reviewStatus([])).toEqual({ state: "success", description: "No visual changes" });
  });

  test("waits for an approval when something changed or is new", () => {
    expect(reviewStatus(visualChanges(tests))).toEqual({
      state: "pending",
      description: "1 changed, 1 new: approve the visual changes (Visual approval job)",
    });
  });
});

describe("commentMarkdown", () => {
  const images = "https://ev.chealt.com/reports/1-1/ui/";
  const report = "https://ev.chealt.com/en/admin/reports/1-1/";
  const run = "https://github.com/chealt/ev-maps/actions/runs/1";

  test("shows main's and the pull request's screenshots, the diff, and links each test", () => {
    const body = commentMarkdown(visualChanges(tests), images, report, run);
    expect(body).toStartWith("<!-- visual-review -->");
    // On top: where to approve them.
    expect(body.split("\n").slice(0, 4).join("\n")).toContain(
      `**[Review and approve the visual changes →](${run})**`
    );
    expect(body).toContain("1 changed, 1 new compared with `main`");
    expect(body).toContain(
      "[google-map.spec.js › shows charger details](https://ev.chealt.com/en/admin/reports/1-1/#?testId=abc)"
    );
    const [changed] = visualChanges(tests);
    for (const kind of ["expected", "actual", "diff"]) {
      expect(body).toContain(`${images}${imageName(changed, kind)}`);
    }
    expect(body).toContain("### New: `a-new-dialog-open.png`");
  });

  test("says when there are no changes anymore", () => {
    expect(commentMarkdown([], images, report, run)).toContain(
      "No visual changes compared with `main` anymore."
    );
  });

  test("names the images as the public ui/ folder allows", () => {
    expect(imageName({ screenshot: "a-b_c.png" }, "diff")).toMatch(/^[\w-]+\.png$/);
  });
});
