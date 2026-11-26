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

**❌ NEVER use loops in specs. Write each step and assertion out.**

**❌ NEVER check layout or visual appearance in end-to-end tests.**

**❌ NEVER write a Playwright spec for what a `@ui` spec's UI evidence already shows.**

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
await page.locator(".charger-details .close").click();
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

### No Loops

Don't loop in a spec: no `for`, `forEach` or `map` over test data to run
steps or assertions. Write each one out, even if they repeat.

```javascript
// ❌ Bad
for (const [field, text] of [
  ["From", "Buda"],
  ["To", "Vie"],
]) {
  await planner.getByRole("combobox", { name: field }).fill(text);
}

// ✅ Good
await planner.getByRole("combobox", { name: "From" }).fill("Buda");
await planner.getByRole("combobox", { name: "To" }).fill("Vie");
```

A spec reads as what the user does, step by step. A loop makes you work out
the steps from a table. When it fails, its line points at the loop, not the
step that broke. To check a list, assert all of it in one go, e.g.
`await expect(items).toHaveText(["Café", "Toilets"])`.

### If an Element Can't Be Found

Fix the markup, not the test. If a query by role, label or text doesn't work,
the element is probably not accessible either. For example:

- Give a region or panel a name with `aria-label` or `aria-labelledby`.
- Connect form fields to a `<label>`.
- Give icon-only buttons an `aria-label`.
- Use semantic elements (`<button>`, `<nav>`, `<aside>`, headings) instead of
  generic `<div>`s.

## What Gets an End-to-End Test

End-to-end tests are slow: each starts a browser and the app. Keep them for
the critical paths a user takes, and the wiring between the page's parts
(the dialog's choices reach the map, a reload restores them, the account
gets them). Test the rules underneath with unit tests (`*.test.js`, run by
`bun test`), which run in milliseconds:

- **Logic is a unit test.** Which chargers a filter matches, how prices
  compare, how a distance is formatted, when a cache expires: test the
  function, with every case and boundary, not through the map. If the logic
  is inside a component, move it into a module first (e.g. `ChargerIndex`
  in `charger-index.js`, tested in `charger-index.test.js`).
- **Mock modules, not globals.** Fetch JSON with `fetchJson`
  (`@ev-maps/ui/fetch-json.js`), not `fetch` and a status check of your
  own, and a unit test mocks that module (`mock.module`) instead of
  replacing `globalThis.fetch`.
- **One flow, not one test per step.** Testing a feature end to end means
  one test that walks through it (turn a filter on, see the map change,
  reload, clear it), not a test per step with the same setup each time.
  Separate tests only for separate starting points (signed out or in, a
  failing API).
- **No variants of the same path.** Four sign-in providers take the same
  code path: test one end to end, the rest in a unit test if at all.
- **No looks.** See [No Visual Checks](#no-visual-checks).

When you add an end-to-end test, say in a comment what the unit tests cover
instead, as the filter specs do.

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

Review visual changes by hand instead, and show them from the tests: a pull
request with new or updated UI controls has tests tagged `@ui`
(`test("…", { tag: "@ui" }, …)`), which attach screenshots of the moments
that show the control (`captureUi(page, testInfo, "the dialog open")`, e.g.
before closing what they opened; without one, the page as the test left
it), next to the video CI records of every test. Each moment is captured
in the light and the dark color scheme (`"…"` and `"… (dark)"`), unless the
page has a theme chosen in the app. Both are in the Playwright
report the CI publishes, linked from its commit status, so the review sees
the control as Playwright actually exercised it.

Each captured moment is compared with `main`'s (see
[Visual review](CI.md#visual-review)), so it has to look the same every run,
**scroll positions included**:

- Wait for what the page does before capturing, e.g. the focus that scrolls a
  dialog (`await expect(button).toBeFocused()`), not only for the dialog.
- Don't let a hover or a click scroll by chance: Playwright scrolls an
  element into view on each retry, by more or less. Where a capture follows a
  hover, move the mouse to an element that's in view
  (`page.mouse.move(…)`), with a scrolled area at a known position.
- In the app, a panel or a dialog that opens for something else starts at
  its top, and content loading into it doesn't scroll it
  (`overflow-anchor: none` on the scrolled areas).

That evidence is the visual check: if a `@ui` spec already captures the
control, don't add a Playwright spec that re-measures or re-asserts it
(e.g. two fields' sizes being equal, an element lining up, a color being
applied). Such specs repeat what the screenshot and video already show, and
break on sub-pixel rounding, fonts and browser versions. Test behavior
(what the user finds, reads and does); let the `@ui` evidence show how it
looks. If the behavior isn't covered yet, add the spec to the spec that
already captures the control's `@ui` moment rather than a new one.

## External Services

Tests never call real external services. Google Maps is replaced by a local
fake (`packages/e2e/fixtures/fake-google-maps.js`), so tests need no
API key or network access and always get the same data.

Reading the fake's recorded state with `page.evaluate()`, such as
`window.__fakeMap.center` or `window.__searchRequests`, is allowed. It checks
what the app asked the service to do, not the DOM. Markers rendered by the
fake must be accessible (e.g. a `<button>` named after the charger), like
the real Google Maps markers, so tests can find them by role.

## Which Tests a Pull Request Runs

On a pull request, CI runs only the end-to-end specs of the domains it
changed, plus every test tagged `@regression`.
`packages/app/e2e-domains.json` maps each domain's paths (globs from the
repository's root) to its specs; the specs live next to what they test (a
component, a page, a `src/lib` module), with the fakes in
`packages/e2e/fixtures``, and `scripts/select-e2e.js`turns the
pull request's changed files into one`--grep` for Playwright, which
matches spec files and tags alike, so the shards stay as they are.

- A change to a shared file (`everything`: dependencies, the Playwright
  config, the fixtures, layouts, pages, the shared packages), or to a file
  under `packages/app` that no domain lists, runs every test.
- Changes outside the app, such as the Worker's (which the end-to-end tests
  fake) or the docs, run only the `@regression` tests.
- Main and runs started by hand run every test.

When adding a spec, add it to a domain (a test checks that every spec is
in one); when adding code to the app, add its path to a domain, or it runs
everything. On a pull request, the E2E map check (see
[CI](CI.md)) reads the change and comments when the map needs an update. Tag a test `@regression`
(`test("…", { tag: "@regression" }, …)`) when it covers a journey every
change must keep working, such as seeing chargers on the map, opening one,
planning a route, saving a favorite or signing out; keep the list short.

## Running Tests

```bash
cd packages/app && bunx playwright install chromium  # first time only
bunx playwright test route-planner favorite-routes   # the specs you changed
bun scripts/select-e2e.js                            # the specs CI would pick
bun run test                                         # every test
```

Locally, run the specs of what you changed; CI runs the rest on the pull
request, and every test on `main`. Running every test is rarely needed
before pushing.
