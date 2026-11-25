// Compares a pull request's UI screenshots with main's (scripts/visual-compare.js):
// no browser, just Playwright's image comparison and its HTML report, which
// shows each change as expected / actual / diff.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "compare.visual.js",
  // The baselines, downloaded from main's last report, by file name.
  snapshotPathTemplate: "{testDir}/../../visual-compare/baseline/{arg}{ext}",
  updateSnapshots: "none",
  reporter: [
    ["json", { outputFile: "../../visual-compare/results.json" }],
    ["html", { outputFolder: "../../visual-compare/report", open: "never" }],
  ],
  outputDir: "../../visual-compare/test-results",
  expect: {
    toMatchSnapshot: {
      // Antialiasing and font rendering may move a few pixels: not a change.
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
    },
  },
});
