// Selects a pull request's end-to-end tests (./e2e-selection.js), from what
// it changed since `base-ref`:
//
//   bun scripts/select-e2e.js [base-ref]
//
// Prints the selection; in GitHub Actions it also sets the step's `grep`
// output for `playwright test --grep` (empty to run them all).

import { appendFile } from "node:fs/promises";
import { REGRESSION_TAG, grepOf, selectE2e } from "./e2e-selection.js";

const mapping = await Bun.file(new URL("../e2e-domains.json", import.meta.url)).json();
const base = process.argv[2] ?? "origin/main";
const { stdout } = Bun.spawnSync(["git", "diff", "--name-only", `${base}...HEAD`]);
const changed = stdout.toString().split("\n").filter(Boolean);
const selection = selectE2e(changed, mapping);
const grep = grepOf(selection);
const summary = selection.all
  ? `All end-to-end tests (${selection.reason} changed).`
  : `End-to-end tests of ${selection.domains.join(", ") || "no domain"}` +
    ` (${selection.tests.join(", ") || "none"}), plus every ${REGRESSION_TAG} test.`;
console.log(summary);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `grep=${grep}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
