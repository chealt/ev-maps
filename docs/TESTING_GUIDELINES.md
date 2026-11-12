# Testing Guidelines

End-to-end tests use [Playwright](https://playwright.dev/) and live in
`packages/app/tests`. They check **behavior from the user's point of view**:
what a user can find, read and do on the page, and what the app sends to
external services.

The rules below follow the
[Testing Library guiding principles](https://testing-library.com/docs/guiding-principles):
the more your tests resemble the way the app is used, the more confidence
they give you.

## 🚨 Rules

**✅ DO find elements by their accessible role, name, label or text.**

**❌ NEVER use CSS selectors, XPath or test IDs to find elements.**

**❌ NEVER wrap queries in one-line helper functions. Write them inline.**

**❌ NEVER check layout or visual appearance in end-to-end tests.**

## Finding Elements

Users (and screen readers) find elements by their role and accessible name,
not by class names or DOM structure. Query them the same way.

### Query Priority

Use the first query in this list that works:

1. `getByRole` - for almost everything: buttons, links, headings, regions,
   lists, form controls and dialogs. Use the `name` option and state options
   such as `expanded`, `checked`, `pressed` or `selected`.
2. `getByLabel` - form fields, by their `<label>`.
3. `getByPlaceholder` - only when a field has no label.
4. `getByText` - non-interactive content, such as a paragraph or list item.
5. `getByAltText` - images.
6. `getByTitle` - only if nothing above works.

### Not Allowed

- `page.locator()` with a CSS selector or XPath, e.g. `.map-status`,
  `ev-google-map` or `//button`
- `getByTestId` and `data-testid` attributes
- `querySelector` or other DOM lookups inside `page.evaluate()`

### Scope with Landmarks, Not Selectors

To narrow a search, chain queries from a landmark or another named element:

```javascript
// ✅ Good
const name = "Downtown Supercharger";
const map = page.getByRole("region", { name: "EV charging station map" });
await map.getByRole("button", { name }).click();

const details = page.getByRole("complementary", { name });
await details.getByRole("button", { name: "Close" }).click();

// ❌ Bad
await page.locator(".google-map .marker").first().click();
await page.locator(".charger-details__close").click();
```

### Check State Through Accessibility

```javascript
// ✅ Good
const openFilters = page.getByRole("button", {
  name: "Filters",
  expanded: true,
});
await expect(openFilters).toBeVisible();
await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

// ❌ Bad
const filterButton = page.locator(".filter-button");
await expect(filterButton).toHaveAttribute("aria-expanded", "true");
await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
```

### Write Queries Inline

Write each query in the test that uses it. Don't wrap queries in one-line
helper functions, even if several tests use the same query.

```javascript
// ❌ Bad
const mapStatus = (page) => page.getByRole("status");
const chargerMarker = (page, name) =>
  page
    .getByRole("region", { name: "EV charging station map" })
    .getByRole("button", { name });

await chargerMarker(page, "Downtown Supercharger").click();
await expect(mapStatus(page)).toHaveText("2 EV chargers found");

// ✅ Good
const map = page.getByRole("region", { name: "EV charging station map" });
await map.getByRole("button", { name: "Downtown Supercharger" }).click();
await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
```

The query is what makes a test readable: its role and name say what the user
sees. A helper hides that behind a name you have to look up, and it can
quietly drift from what it finds.

What's fine:

- Storing a locator in a local variable inside one test, when that test uses
  it several times, e.g. `const markers = map.getByRole("button")`
- Constants for test data, such as a charger name used in several assertions
- Helpers that aren't queries, such as faking an external service or reading
  a fake's recorded state

### If an Element Can't Be Found

Fix the markup, not the test. If a query by role, label or text doesn't work,
the element is probably not accessible either. For example:

- Give a region or panel a name with `aria-label` or `aria-labelledby`.
- Connect form fields to a `<label>`.
- Give icon-only buttons an `aria-label`.
- Use semantic elements (`<button>`, `<nav>`, `<aside>`, headings) instead of
  generic `<div>`s.

## No Visual Checks

End-to-end tests must not check how the page looks or where things are.
Don't use:

- `boundingBox()`, `getBoundingClientRect()`, element sizes or offsets
- `getComputedStyle()` or `toHaveCSS()`
- `toBeInViewport()` to check layout
- Screenshot comparisons (`toHaveScreenshot()`, `toMatchSnapshot()` on images)
- Class names as a stand-in for state (e.g. `toHaveClass("is-open")`)

These checks break whenever the design changes, depend on fonts, browser
version and screen size, and don't show that a feature works.

What's fine:

- `toBeVisible()` and `toBeHidden()`, which check whether the user can
  perceive an element at all
- State exposed to assistive technology: `expanded`, `checked`, `disabled`,
  `selected`, and so on

Review visual changes by hand instead, and add screenshots of desktop and
mobile to the pull request.

## External Services

Tests never call real external services. Google Maps is replaced by a local
fake (`packages/app/tests/fixtures/fake-google-maps.js`), so tests need no
API key or network access and always get the same data.

Reading the fake's recorded state with `page.evaluate()`, such as
`window.__fakeMap.center` or `window.__searchRequests`, is allowed. It checks
what the app asked the service to do, not the DOM. Markers rendered by the
fake must be accessible (e.g. a `<button>` named after the charger), like
the real Google Maps markers, so tests can find them by role.

## Running Tests

```bash
cd packages/app && bunx playwright install chromium  # first time only
bun run test
```
