import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";
import { fakeChargersApi, requestCovers } from "./fixtures/chargers-api.js";

// The country pages are built from tests/fixtures/country-chargers (see
// playwright.config.js): Hungary has four chargers.

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
});

test("has a page for each country with chargers", async ({ page }) => {
  await page.goto("/en/hu/");

  await expect(page).toHaveTitle("EV chargers in Hungary - EV Maps");
});

test("shows the whole country's chargers without loading them", async ({ page }) => {
  const requests = await fakeChargersApi(page);
  await page.goto("/en/hu/");
  const map = page.getByRole("region", { name: "EV charging station map" });

  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  await expect(map.getByRole("button", { name: "Budapest Hub" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Szeged Charger" })).toBeVisible();
  expect(requests).toHaveLength(0);
});

test("starts on the country", async ({ page }) => {
  await page.goto("/en/hu/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");

  const center = await page.evaluate(() => window.__fakeMap.center);
  expect(center.lat).toBeGreaterThan(45.7);
  expect(center.lat).toBeLessThan(48.6);
  expect(center.lng).toBeGreaterThan(16.1);
  expect(center.lng).toBeLessThan(22.9);
});

test("loads chargers from the API when zoomed in", async ({ page }) => {
  const requests = await fakeChargersApi(page);
  await page.goto("/en/hu/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");

  const budapest = { lat: 47.4979, lng: 19.0402 };
  await page.evaluate((center) => {
    window.__fakeMap.setCenter(center);
    window.__fakeMap.setZoom(12);
  }, budapest);

  await expect.poll(() => requests.some((request) => requestCovers(request, budapest))).toBe(true);
  // The fake API answers every tile with its two fixture chargers.
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test("opens the details of a country page charger", async ({ page }) => {
  await page.goto("/en/hu/");
  const map = page.getByRole("region", { name: "EV charging station map" });

  await map.getByRole("button", { name: "Budapest Hub" }).click();

  const details = page.getByRole("complementary", { name: "Budapest Hub" });
  await expect(details.getByText("Deák Ferenc tér, Budapest")).toBeVisible();
  await expect(details.getByText("CCS (Type 2): 2× · 150 kW")).toBeVisible();
});

test("keeps the saved view instead of the country", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/en/hu/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  const budapest = { lat: 47.4979, lng: 19.0402 };
  await page.evaluate((center) => {
    window.__fakeMap.setCenter(center);
    window.__fakeMap.setZoom(12);
  }, budapest);
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  expect(await page.evaluate(() => window.__fakeMap.center)).toEqual(budapest);
  expect(await page.evaluate(() => window.__fakeMap.zoom)).toBe(12);
});
