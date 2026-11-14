import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;

export default defineConfig({
  testDir: "./tests",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Requests made by a service worker bypass page.route(), so the external
    // APIs couldn't be faked; without it the app fetches directly.
    serviceWorkers: "block",
    // CI keeps a video of every test and a trace of every failed attempt;
    // both are attached to the HTML report artifact.
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",
    video: process.env.CI ? "on" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx --bun astro dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_GOOGLE_MAPS_API_KEY: "test-api-key",
      VITE_OPEN_CHARGE_MAP_API_KEY: "test-ocm-key",
      VITE_GOOGLE_MAPS_MAP_ID: "TEST_MAP_ID",
      VITE_GOOGLE_CLIENT_ID: "test-client-id",
    },
  },
});
