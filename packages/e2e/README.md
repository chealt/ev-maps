# E2E fixtures

The Playwright fixtures and fake APIs every E2E spec shares, as a package:
`test` (Playwright's, extended with an axe accessibility check and, for tests
tagged `@performance`, web-vitals measurement — see the app's
`docs/features/test-reports.md`), and fakes for the app's APIs (sign-in,
chargers, Google Maps, settings, favorites) that specs route the browser's
requests to.

The app's specs import them, e.g.:

```js
import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeChargersApi } from "@ev-maps/e2e/chargers-api.js";
```

The country pages' charger data (`tests/fixtures/country-chargers`) stays
with the app: the dev server loads it, not the tests.
