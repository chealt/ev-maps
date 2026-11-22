# E2E

Playwright's `test` and `expect` for end-to-end suites, with nothing of the
app in it, like a third-party library:

- every passing test's page is checked with axe against WCAG 2.1 A and AA,
  and any violation fails the test; the results are attached ("axe")
- tests tagged `@performance` also have their page's load measured (TTFB,
  FCP, LCP, CLS), fail on Google's poor thresholds, and attach them
  ("web-vitals")

```js
import { expect, test } from "@ev-maps/e2e/test.js";
```

An app's own fixtures (its fake APIs, test data) stay with its tests; this
package is only the generic harness. See the app's
`docs/features/test-reports.md` for the reports built from the attachments.
