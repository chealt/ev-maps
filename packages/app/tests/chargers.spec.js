import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";
import { fakeOpenChargeMap, requestCovers } from "./fixtures/open-charge-map.js";

const hours = (count) => count * 60 * 60 * 1000;

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
});

test("loads chargers for the visible area with the API key", async ({ page }) => {
  const requests = await fakeOpenChargeMap(page);
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((request) => request.searchParams.get("key") === "test-ocm-key")).toBe(
    true
  );
  expect(requests.some((request) => requestCovers(request, { lat: 40.7128, lng: -74.006 }))).toBe(
    true
  );
});

test("loads chargers again when the map moves to a new area", async ({ page }) => {
  const requests = await fakeOpenChargeMap(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  const london = { lat: 51.5074, lng: -0.1278 };
  await page.evaluate((center) => window.__fakeMap.setCenter(center), london);

  await expect.poll(() => requests.some((request) => requestCovers(request, london))).toBe(true);
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test("uses cached chargers for a day", async ({ page }) => {
  const start = new Date("2026-01-01T08:00:00Z").getTime();
  const requests = await fakeOpenChargeMap(page);

  await page.clock.setFixedTime(start);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  const firstLoad = requests.length;
  expect(firstLoad).toBeGreaterThan(0);

  await page.clock.setFixedTime(start + hours(23));
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(requests).toHaveLength(firstLoad);

  await page.clock.setFixedTime(start + hours(25));
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(requests).toHaveLength(firstLoad * 2);
});

test("asks to zoom in when the visible area is too large", async ({ page }) => {
  await fakeOpenChargeMap(page);
  await page.goto("/");
  const markers = page.getByRole("region", { name: "EV charging station map" }).getByRole("button");
  await expect(markers).toHaveCount(2);

  await page.evaluate(() => window.__fakeMap.setZoom(5));
  await expect(page.getByRole("status")).toHaveText("Zoom in to see EV chargers");
  await expect(markers).toHaveCount(0);

  await page.evaluate(() => window.__fakeMap.setZoom(12));
  await expect(markers).toHaveCount(2);
});

test("says when only some chargers are shown", async ({ page }) => {
  await fakeOpenChargeMap(page, { fillTiles: true });
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText(
    /^Showing \d+ EV chargers, zoom in to see all$/
  );
});

test("reports a failed request", async ({ page }) => {
  await page.route("https://api.openchargemap.io/v3/poi?**", (route) =>
    route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } })
  );
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("Could not load EV chargers");
});
