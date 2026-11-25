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
//
// Tests tagged @ui (test("…", { tag: "@ui" }, …)), those that show a new or
// updated UI control, attach screenshots ("ui"): with the video CI records
// of every test, a pull request's report shows what the control looks and
// feels like. A test captures the moments that show it with
// `await captureUi(page, testInfo, "the dialog open")`, e.g. before closing
// what it opened; one that captures none gets the page as it left it.
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import { THRESHOLDS, measureWebVitals } from "./web-vitals.js";

const PERFORMANCE_TAG = "@performance";
const UI_TAG = "@ui";

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

// The screenshot's name for the visual comparison: the test's titles and the
// caption, e.g. "shows-charger-details-when-a-marker-is-clicked--the-charger-s-details.png".
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

// Visual regression (#309, docs/CI.md): with VISUAL_COMPARE, each moment is
// also matched against main's screenshot of it with Playwright's
// toHaveScreenshot (the baselines in packages/app/visual-baseline/). A
// difference doesn't fail the test: it's a "visual-change" annotation, with
// Playwright's expected, actual and diff images attached to the test, for a
// person to approve. On main, --update-snapshots=all makes them the baselines.
const compareWithMain = async (page, testInfo, caption) => {
  if (!process.env.VISUAL_COMPARE) {
    return;
  }
  const name = `${slug([...testInfo.titlePath.slice(1), caption].filter(Boolean).join(" "))}.png`;
  const isNew = !existsSync(testInfo.snapshotPath(name));
  try {
    await expect(page).toHaveScreenshot(name);
  } catch {
    testInfo.annotations.push({
      type: "visual-change",
      description: `${isNew ? "new" : "changed"}: ${name}`,
    });
  }
};

// Colors in the middle of a fade-in (or a theme's transition) aren't what anyone reads; nor a page
// still scrolling: this waits until no scrolled area (a dialog, the
// charger's panel) has moved for a few frames, so a focus or a hover that
// scrolls it has, every run, by the time of the screenshot.
const settle = (page) =>
  page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {}))
    );
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const positions = () =>
      [...document.querySelectorAll("*")]
        .filter((element) => element.scrollTop || element.scrollLeft)
        .map((element) => `${element.scrollTop},${element.scrollLeft}`)
        .join("|");
    let last = positions();
    for (let still = 0, frames = 0; still < 3 && frames < 60; frames++) {
      await frame();
      const now = positions();
      still = now === last ? still + 1 : 0;
      last = now;
    }
  });

// The page as it is, and in the other color scheme too (#308): "ui: {caption}"
// and "ui: {caption} (dark)" (or "(light)"), each in its scheme, and each
// compared with main's (compareWithMain). Not the other scheme when the page
// has a theme of its own (the theme picker's data-theme), which the system's
// scheme doesn't change.
const captureUi = async (page, testInfo, caption) => {
  const capture = async (name) => {
    await settle(page);
    await testInfo.attach(name ? `ui: ${name}` : "ui", {
      contentType: "image/png",
      body: await page.screenshot(),
    });
    await compareWithMain(page, testInfo, name);
  };
  await capture(caption);
  const { dark, themed } = await page.evaluate(() => ({
    dark: matchMedia("(prefers-color-scheme: dark)").matches,
    themed: Boolean(document.documentElement.dataset.theme),
  }));
  if (themed) {
    return;
  }
  const other = dark ? "light" : "dark";
  await page.emulateMedia({ colorScheme: other });
  try {
    await capture(caption ? `${caption} (${other})` : other);
  } finally {
    await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
    await settle(page);
  }
};

const isUiEvidence = ({ name }) => name === "ui" || name.startsWith("ui: ");

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
    if (testInfo.tags.includes(UI_TAG) && !testInfo.attachments.some(isUiEvidence)) {
      await captureUi(page, testInfo);
    }
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    await testInfo.attach("axe", {
      contentType: "application/json",
      body: JSON.stringify(summaryOf(results)),
    });
    expect(results.violations, describe(results.violations)).toEqual([]);
  },
});

export { captureUi, expect, test };
