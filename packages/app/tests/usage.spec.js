import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

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

test("counts page views and what's used, and sends them together", async ({ page }) => {
  const batches = await fakeUsageApi(page);
  await page.goto("/hu/");
  await expect(page.getByRole("status")).toHaveText("2 töltőállomás található");
  const map = page.getByRole("region", { name: "Töltőállomások térképe" });

  await map.getByRole("button", { name: "Downtown Supercharger" }).click();
  await page.getByRole("button", { name: "Szűrők", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Szűrők" });
  await filters.getByRole("button", { name: "CCS" }).click();
  await filters.getByRole("button", { name: "< 50 kW" }).click();
  await leavePage(page);

  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0]).toEqual({
    events: {
      page_view: { "hu:home": 1 },
      charger_opened: { ocm: 1 },
      filter_used: { connector: 1, power: 1 },
    },
  });

  // Nothing new, nothing sent.
  await leavePage(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(1);
});

test("counts the kind of page, but not the admin area", async ({ page }) => {
  const batches = await fakeUsageApi(page);
  await page.goto("/en/privacy/");
  await leavePage(page);
  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0].events.page_view).toEqual({ "en:legal": 1 });

  await page.route("**/api/admin/me", (route) => route.fulfill({ status: 403, json: {} }));
  await page.goto("/en/admin/");
  await leavePage(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(1);
});

test("counts sign-in attempts by method", async ({ page }) => {
  const batches = await fakeUsageApi(page);
  await fakeAuthApi(page, { signInStatus: 500 });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await leavePage(page);

  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0].events.sign_in_started).toEqual({ google: 1 });
});
