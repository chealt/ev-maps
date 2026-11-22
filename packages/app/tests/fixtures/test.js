// Playwright's test and expect for every spec, with an accessibility check:
// at the end of each test, axe (axe-core) checks the page as the test left it
// against WCAG 2.1 A and AA, and the test fails on any violation.
import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// One line per violation: the rule, its impact, and where.
const describe = (violations) =>
  violations
    .map(
      ({ id, impact, help, nodes }) =>
        `${id} (${impact}): ${help}\n${nodes.map((node) => `  - ${node.target.join(" ")}`).join("\n")}`
    )
    .join("\n");

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    // Only pages the test got to, and only when it passed: a failed test
    // already says what's wrong.
    if (testInfo.status !== testInfo.expectedStatus || !page.url().startsWith("http")) {
      return;
    }
    // Colors in the middle of a fade-in aren't what anyone reads.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
    );
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations, describe(violations)).toEqual([]);
  },
});

export { expect, test };
