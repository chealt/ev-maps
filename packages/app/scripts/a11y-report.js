// The accessibility report of a CI run: every test's axe results (attached by
// tests/fixtures/test.js) from Playwright's JSON summary, as one HTML page,
// a11y-report/index.html. CI publishes it with the Playwright report
// (scripts/publish-test-report.js).
//
//   bun scripts/a11y-report.js
//
// Returns (and prints) the totals: { tests, pages, violations, incomplete }.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const RESULTS_FILE = "playwright-results.json";
const REPORT_DIR = "a11y-report";

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );

// [{ title, file, axe }] for every test result with axe results.
const axeResults = (results) => {
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const attachment = result.attachments?.find((item) => item.name === "axe");
          if (attachment?.body) {
            found.push({
              title: [...titles, spec.title].join(" › "),
              file: spec.file,
              axe: JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8")),
            });
          }
        }
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, suite.title && !suite.title.endsWith(".js") ? [...titles, suite.title] : titles);
    }
  };
  for (const suite of results.suites ?? []) {
    walk(suite, []);
  }
  return found;
};

// The rules over all tests: { id, impact, help, helpUrl, tests: n, targets }.
const byRule = (checks, kind) => {
  const rules = new Map();
  for (const { title, axe } of checks) {
    for (const rule of axe[kind]) {
      const entry = rules.get(rule.id) ?? { ...rule, tests: [], targets: new Set() };
      entry.tests.push(title);
      for (const target of rule.targets) {
        entry.targets.add(target);
      }
      rules.set(rule.id, entry);
    }
  }
  return [...rules.values()].sort((a, b) => b.tests.length - a.tests.length);
};

const ruleTable = (rules, empty) =>
  rules.length === 0
    ? `<p>${empty}</p>`
    : `<table>
  <thead><tr><th>Rule</th><th>Impact</th><th>Tests</th><th>Where</th></tr></thead>
  <tbody>
${rules
  .map(
    (rule) => `    <tr>
      <td><a href="${escapeHtml(rule.helpUrl)}">${escapeHtml(rule.id)}</a><br>${escapeHtml(rule.help)}</td>
      <td>${escapeHtml(rule.impact ?? "")}</td>
      <td>${rule.tests.length}</td>
      <td><ul>${[...rule.targets]
        .slice(0, 10)
        .map((target) => `<li><code>${escapeHtml(target)}</code></li>`)
        .join("")}</ul></td>
    </tr>`
  )
  .join("\n")}
  </tbody>
</table>`;

const html = (checks, totals) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Accessibility report</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
  body { max-width: 72rem; margin: 2rem auto; padding: 0 1rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0 2rem; font-size: 0.875rem; }
  th, td { padding: 0.5rem; border-bottom: 1px solid #94a3b8; text-align: left; vertical-align: top; }
  ul { margin: 0; padding-left: 1rem; }
  .totals { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0; list-style: none; }
  .totals li { padding: 0.75rem 1rem; border: 1px solid #94a3b8; border-radius: 0.5rem; }
  .totals strong { display: block; font-size: 1.5rem; }
</style>
</head>
<body>
<h1>Accessibility report</h1>
<p>axe-core checked the page at the end of each passing end-to-end test, against WCAG 2.1 A and AA.
Any violation fails the test.</p>
<ul class="totals">
  <li><strong>${totals.tests}</strong> tests checked</li>
  <li><strong>${totals.pages}</strong> different pages</li>
  <li><strong>${totals.violations}</strong> rules violated</li>
  <li><strong>${totals.incomplete}</strong> rules to check by hand</li>
</ul>
<h2>Violations</h2>
${ruleTable(byRule(checks, "violations"), "None.")}
<h2>To check by hand</h2>
<p>Where axe couldn't decide, e.g. text over an image.</p>
${ruleTable(byRule(checks, "incomplete"), "None.")}
<h2>Tests</h2>
<table>
  <thead><tr><th>Test</th><th>Page</th><th>Rules passed</th><th>Violations</th><th>To check</th></tr></thead>
  <tbody>
${checks
  .map(
    ({ title, file, axe }) => `    <tr>
      <td>${escapeHtml(title)}<br><small>${escapeHtml(file)}</small></td>
      <td><code>${escapeHtml(new URL(axe.url).pathname + new URL(axe.url).search)}</code></td>
      <td>${axe.passed}</td>
      <td>${axe.violations.length}</td>
      <td>${axe.incomplete.length}</td>
    </tr>`
  )
  .join("\n")}
  </tbody>
</table>
</body>
</html>
`;

const writeA11yReport = async () => {
  const checks = axeResults(JSON.parse(await readFile(RESULTS_FILE, "utf8")));
  const totals = {
    tests: checks.length,
    pages: new Set(checks.map(({ axe }) => new URL(axe.url).pathname)).size,
    violations: byRule(checks, "violations").length,
    incomplete: byRule(checks, "incomplete").length,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(`${REPORT_DIR}/index.html`, html(checks, totals));
  return totals;
};

if (import.meta.main) {
  console.log(await writeA11yReport());
}

export { REPORT_DIR, axeResults, byRule, writeA11yReport };
