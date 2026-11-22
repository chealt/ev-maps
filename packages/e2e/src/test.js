// Playwright's test and expect for any end-to-end suite, with nothing of
// the app in it. At the end of each test, axe (axe-core) checks the page as
// the test left it against WCAG 2.1 A and AA, and the test fails on any
// violation. The results are attached to the test ("axe"), e.g. for an
// accessibility report.
//
// Tests tagged @performance (test("…", { tag: "@performance" }, …)), those
// that load a whole page, also measure its load (TTFB, FCP, LCP, CLS) before
// that: they fail if a metric is poor by Google's thresholds, and attach them
// ("web-vitals"), e.g. for a performance report of each page's P75.
import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import { THRESHOLDS, measureWebVitals } from "./web-vitals.js";

const PERFORMANCE_TAG = "@performance";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// One line per violation: the rule, its impact, and where.
const describe = (violations) =>
  violations
    .map(
      ({ id, impact, help, nodes }) =>
        `${id} (${impact}): ${help}\n${nodes.map((node) => `  - ${node.target.join(" ")}`).join("\n")}`
    )
    .join("\n");

// What the report shows: the page, the rules that passed, and the rules that
// failed or that axe couldn't decide (to check by hand), with where.
const summaryOf = ({ url, passes, violations, incomplete }) => {
  const rules = (list) =>
    list.map(({ id, impact, help, helpUrl, nodes }) => ({
      id,
      impact,
      help,
      helpUrl,
      targets: nodes.map((node) => node.target.join(" ")),
    }));
  return {
    url,
    passed: passes.length,
    violations: rules(violations),
    incomplete: rules(incomplete),
  };
};

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    // Only pages the test got to, and only when it passed: a failed test
    // already says what's wrong.
    if (testInfo.status !== testInfo.expectedStatus || !page.url().startsWith("http")) {
      return;
    }
    if (testInfo.tags.includes(PERFORMANCE_TAG)) {
      const vitals = await measureWebVitals(page);
      await testInfo.attach("web-vitals", {
        contentType: "application/json",
        body: JSON.stringify(vitals),
      });
      const poor = Object.entries(THRESHOLDS)
        .filter(([name, [, poorAt]]) => vitals[name] !== null && vitals[name] > poorAt)
        .map(([name]) => `${name} ${vitals[name]}`);
      expect(poor, `Poor load metrics on ${vitals.url}`).toEqual([]);
    }
    // Colors in the middle of a fade-in aren't what anyone reads.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
    );
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    await testInfo.attach("axe", {
      contentType: "application/json",
      body: JSON.stringify(summaryOf(results)),
    });
    expect(results.violations, describe(results.violations)).toEqual([]);
  },
});

export { expect, test };
