import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const fakeUsageApi = async (page) => {
  const batches = [];
  await page.route("**/api/usage", (route) => {
    batches.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { counted: true } });
  });
  return batches;
};

// The page sends its counts every 30 seconds and when it's left.
const leavePage = (page) => page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
});

test("counts page views, what's used and sign-in attempts, and sends them together", async ({
  page,
}) => {
  const batches = await fakeUsageApi(page);
  await fakeAuthApi(page, { signInStatus: 500 });
  await page.goto("/hu/");
  await expect(page.getByRole("status")).toHaveText("2 töltőállomás található");
  const map = page.getByRole("region", { name: "Töltőállomások térképe" });

  await map.getByRole("button", { name: "Downtown Supercharger" }).click();
  await page.getByRole("button", { name: "Szűrők", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Szűrők" });
  await filters.getByRole("button", { name: "CCS" }).click();
  await filters.getByRole("button", { name: "< 50 kW" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await page.getByRole("button", { name: "Bejelentkezés Google-fiókkal" }).click();
  await leavePage(page);

  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0]).toEqual({
    events: {
      page_view: { "hu:home": 1 },
      page_path: { "/hu/": 1 },
      charger_opened: { ocm: 1 },
      filter_used: { connector: 1, power: 1 },
      sign_in_started: { google: 1 },
    },
  });

  // Nothing new, nothing sent.
  await leavePage(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(1);
});

test("counts the kind of page and the page, but not the admin area", async ({ page }) => {
  const batches = await fakeUsageApi(page);
  await page.goto("/en/privacy/");
  await leavePage(page);
  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0].events.page_view).toEqual({ "en:legal": 1 });
  expect(batches[0].events.page_path).toEqual({ "/en/privacy/": 1 });

  await page.route("**/api/admin/me", (route) => route.fulfill({ status: 403, json: {} }));
  await page.goto("/en/admin/");
  await leavePage(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(1);
});

test.describe("with the service worker", () => {
  // Every other test blocks service workers (see playwright.config.js).
  test.use({ serviceWorkers: "allow" });

  // Requests the service worker makes only reach routes on the context.
  const fakeReportApis = async (page) => {
    const sent = { usage: [], errors: [], fromPage: 0 };
    const record = (list) => (route) => {
      if (!route.request().serviceWorker()) {
        sent.fromPage++;
      }
      list.push(route.request().postDataJSON());
      return route.fulfill({ status: 202, json: {} });
    };
    await page.context().route("**/api/usage", record(sent.usage));
    await page.context().route("**/api/errors", record(sent.errors));
    return sent;
  };

  test("hands the counts and errors to it, which sends them for the page", async ({ page }) => {
    const sent = await fakeReportApis(page);
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    const before = sent.usage.length;

    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    await page.evaluate(() => setTimeout(() => Promise.reject(new Error("Lost charger"))));
    await leavePage(page);

    // The counts of both visits, merged by the service worker: the first
    // visit's went to it as soon as it took over the page.
    await expect.poll(() => sent.usage.length, { timeout: 20000 }).toBeGreaterThan(before);
    const counts = sent.usage.slice(before).reduce((all, { events }) => {
      for (const [event, dimensions] of Object.entries(events)) {
        for (const [dimension, count] of Object.entries(dimensions)) {
          all[`${event}:${dimension}`] = (all[`${event}:${dimension}`] ?? 0) + count;
        }
      }
      return all;
    }, {});
    expect(counts).toMatchObject({ "page_view:en:home": 2, "charger_opened:ocm": 1 });
    await expect.poll(() => sent.errors.map((error) => error.message)).toContain("Lost charger");
    // The page itself sent nothing: no timers, no pagehide sends.
    expect(sent.fromPage).toBe(0);
  });
});
