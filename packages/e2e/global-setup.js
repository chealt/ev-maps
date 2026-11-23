// Warms the development server before the tests: Vite compiles a page's
// server code and scripts the first time it's asked for them, which takes
// seconds on a CI runner. Without this, whichever @performance test reached
// a page first in its shard measured that compiling, not the page (e.g. a
// 3.4 s TTFB for the admin usage page that is 60 ms otherwise).
//
// Each page is loaded once in a browser, so its scripts compile too; requests
// leaving the server (Google Maps, the API, which the tests fake) are
// stopped, as nothing here needs their answers.

import { chromium } from "@playwright/test";

// The pages the @performance tests measure, and the languages' home pages.
const PAGES = [
  "/en/",
  "/pl/",
  "/en/hu/",
  "/en/pl/",
  "/en/terms/",
  "/en/admin/",
  "/en/admin/errors/",
  "/en/admin/performance/",
  "/en/admin/reports/",
  "/en/admin/usage/",
];

const globalSetup = async (config) => {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL).origin && !url.pathname.startsWith("/api/")
      ? route.continue()
      : route.abort();
  });
  for (const path of PAGES) {
    await page.goto(new URL(path, baseURL).href, { waitUntil: "load" }).catch((error) => {
      // A page that doesn't load here fails its own tests, with a clearer
      // message.
      console.warn(`Could not warm ${path}: ${error.message}`);
    });
  }
  await browser.close();
};

export default globalSetup;
