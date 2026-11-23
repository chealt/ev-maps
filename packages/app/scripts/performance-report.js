// The performance report of a CI run: the load metrics of every page the
// @performance tests measured (packages/e2e/src/test.js), as each page's P75,
// rated by Google's thresholds, in one HTML page,
// performance-report/index.html. CI publishes it with the Playwright report
// (scripts/publish-test-report.js).
//
//   bun scripts/performance-report.js
//
// Returns (and prints) the totals: { samples, pages, poor }.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { THRESHOLDS } from "@ev-maps/e2e/web-vitals.js";
import { attachmentsNamed, escapeHtml } from "./report-attachments.js";

const RESULTS_FILE = "playwright-results.json";
const REPORT_DIR = "performance-report";
const METRICS = Object.keys(THRESHOLDS);

// The 75th percentile (nearest rank) of the numbers, or null without any.
const p75 = (values) => {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.75) - 1] : null;
};

const ratingOf = (metric, value) => {
  if (value === null) {
    return null;
  }
  const [good, poor] = THRESHOLDS[metric];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
};

// [{ path, samples, metrics: { LCP: { p75, rating } … } }], by path.
const pagesOf = (measurements) => {
  const byPath = Map.groupBy(measurements, ({ value }) => new URL(value.url).pathname);
  return [...byPath]
    .map(([path, samples]) => ({
      path,
      samples: samples.length,
      tests: samples.map(({ title }) => title),
      metrics: Object.fromEntries(
        METRICS.map((metric) => {
          const value = p75(samples.map((sample) => sample.value[metric]));
          return [metric, { p75: value, rating: ratingOf(metric, value) }];
        })
      ),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
};

const formatValue = (metric, value) =>
  value === null ? "–" : metric === "CLS" ? value.toFixed(3) : `${value} ms`;

const RATING_LABELS = { good: "Good", "needs-improvement": "Needs improvement", poor: "Poor" };

const html = (pages, totals) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Performance report</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
  body { max-width: 72rem; margin: 2rem auto; padding: 0 1rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0 2rem; font-size: 0.875rem; }
  th, td { padding: 0.5rem; border-bottom: 1px solid #94a3b8; text-align: left; vertical-align: top; }
  .totals { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0; list-style: none; }
  .totals li { padding: 0.75rem 1rem; border: 1px solid #94a3b8; border-radius: 0.5rem; }
  .totals strong { display: block; font-size: 1.5rem; }
  .good { color: light-dark(#047857, #6ee7b7); }
  .needs-improvement { color: light-dark(#b45309, #fcd34d); }
  .poor { color: light-dark(#b91c1c, #fca5a5); font-weight: 600; }
</style>
</head>
<body>
<h1>Performance report</h1>
<p>Each page's 75th percentile (P75) of its load metrics, measured at the end of the end-to-end
tests tagged <code>@performance</code>, rated by Google's thresholds. The tests run against the
development server, with the APIs faked: compare runs with each other, not with production
(the admin area's performance page has that).</p>
<ul class="totals">
  <li><strong>${totals.pages}</strong> pages</li>
  <li><strong>${totals.samples}</strong> measurements</li>
  <li><strong>${totals.poor}</strong> poor P75s</li>
</ul>
<table>
  <thead><tr><th>Page</th><th>Samples</th>${METRICS.map(
    (metric) =>
      `<th>${metric} P75<br><small>good ≤ ${formatValue(metric, THRESHOLDS[metric][0])}</small></th>`
  ).join("")}</tr></thead>
  <tbody>
${pages
  .map(
    (page) => `    <tr>
      <td><code>${escapeHtml(page.path)}</code></td>
      <td title="${escapeHtml(page.tests.join("\n"))}">${page.samples}</td>
${METRICS.map((metric) => {
  const { p75: value, rating } = page.metrics[metric];
  return `      <td class="${rating ?? ""}">${formatValue(metric, value)}${
    rating ? `<br><small>${RATING_LABELS[rating]}</small>` : ""
  }</td>`;
}).join("\n")}
    </tr>`
  )
  .join("\n")}
  </tbody>
</table>
</body>
</html>
`;

const writePerformanceReport = async () => {
  const measurements = attachmentsNamed(
    JSON.parse(await readFile(RESULTS_FILE, "utf8")),
    "web-vitals"
  );
  const pages = pagesOf(measurements);
  const totals = {
    samples: measurements.length,
    pages: pages.length,
    poor: pages
      .flatMap((page) => Object.values(page.metrics))
      .filter(({ rating }) => rating === "poor").length,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(`${REPORT_DIR}/index.html`, html(pages, totals));
  return totals;
};

if (import.meta.main) {
  console.log(await writePerformanceReport());
}

export { REPORT_DIR, p75, pagesOf, ratingOf, writePerformanceReport };
