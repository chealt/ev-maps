import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;

export default defineConfig({
  // The specs live next to what they test (a component, a page, a lib), with
  // the fakes in @ev-maps/e2e/fixtures.
  // The specs of the admin package's components too (packages/admin/components).
  testDir: "../",
  testMatch: "**/*.spec.js",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // CI runs the tests in shards (.github/workflows/app.yml), each saving a
  // blob report; the Test job merges them into the HTML report and the JSON
  // summary that scripts/publish-test-report.js publishes for the admin area.
  reporter: process.env.CI ? [["github"], ["blob"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Requests made by a service worker bypass page.route(), so the external
    // APIs couldn't be faked; without it the app fetches directly.
    serviceWorkers: "block",
    // No animations, so a test can act as soon as something shows, as a
    // user's next click would; tests/motion.spec.js turns them on to check
    // the animated path.
    reducedMotion: "reduce",
    // CI keeps a video of every test and a trace of every failed attempt;
    // both are attached to the HTML report artifact.
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",
    video: process.env.CI ? "on" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // --ignore-lock: a one-off server in the foreground, next to any running
    // `astro dev` (Astro otherwise refuses a second one, and backgrounds the
    // server when it detects a coding agent).
    // Node, not Bun: the Cloudflare adapter's dev server (workerd, through
    // miniflare) doesn't start under Bun.
    command: `node node_modules/.bin/astro dev --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_GOOGLE_MAPS_API_KEY: "test-api-key",
      VITE_GOOGLE_MAPS_MAP_ID: "TEST_MAP_ID",
      // The country pages' chargers, instead of an export of the database.
      EV_MAPS_CHARGERS_DIR: "../e2e/fixtures/country-chargers",
      // Poland's fixture has 6 chargers, so its page holds only some of them.
      EV_MAPS_MAX_PAGE_CHARGERS: "4",
      // No Worker runs: the tests fake the API, so no proxy to it.
      EV_MAPS_NO_API_PROXY: "1",
    },
  },
});
