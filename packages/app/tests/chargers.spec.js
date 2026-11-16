import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";
import { fakeChargersApi, requestCovers, tileWidth } from "./fixtures/chargers-api.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
});

test("loads chargers for the visible area", async ({ page }) => {
  const requests = await fakeChargersApi(page);
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.some((request) => requestCovers(request, { lat: 40.7128, lng: -74.006 }))).toBe(
    true
  );
});

test("loads chargers again when the map moves to a new area", async ({ page }) => {
  const requests = await fakeChargersApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  const london = { lat: 51.5074, lng: -0.1278 };
  await page.evaluate((center) => window.__fakeMap.setCenter(center), london);

  await expect.poll(() => requests.some((request) => requestCovers(request, london))).toBe(true);
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test.describe("with the service worker", () => {
  // Every other test blocks service workers (see playwright.config.js).
  test.use({ serviceWorkers: "allow" });

  // Once the service worker controls the page, every Open Charge Map request
  // goes through it; requests made before that went straight to the network.
  const loadControlledPage = async (page) => {
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  };

  // The service worker keeps responses for a day, by the time it stored them.
  // Its clock can't be faked, so make the stored responses a day older.
  const ageCachedResponses = (page) =>
    page.evaluate(
      async (dayMs) => {
        const cache = await caches.open("ev-maps-chargers-v1");
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          const headers = new Headers(response.headers);
          headers.set("x-ev-maps-cached-at", String(Date.now() - dayMs - 1000));
          await cache.put(request, new Response(await response.blob(), { headers }));
        }
      },
      24 * 60 * 60 * 1000
    );

  test("serves chargers from its cache after a reload", async ({ page }) => {
    const requests = await fakeChargersApi(page);
    await loadControlledPage(page);
    const requestCount = requests.length;

    await page.reload();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    expect(requests).toHaveLength(requestCount);
  });

  test("loads chargers again after a day", async ({ page }) => {
    const requests = await fakeChargersApi(page);
    await loadControlledPage(page);
    const requestCount = requests.length;

    await ageCachedResponses(page);
    await page.reload();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    expect(requests.length).toBeGreaterThan(requestCount);
  });

  test("uses expired chargers when the network fails", async ({ page }) => {
    await fakeChargersApi(page);
    await loadControlledPage(page);
    await ageCachedResponses(page);

    await page.context().unrouteAll();
    await page.context().route("**/api/chargers/**", (route) => route.abort());
    await page.reload();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  });
});

test("asks to zoom in when the visible area is too large", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/");
  const markers = page.getByRole("region", { name: "EV charging station map" }).getByRole("button");
  await expect(markers).toHaveCount(2);

  await page.evaluate(() => window.__fakeMap.setZoom(5));
  await expect(page.getByRole("status")).toHaveText("Zoom in to see EV chargers");
  await expect(markers).toHaveCount(0);

  await page.evaluate(() => window.__fakeMap.setZoom(12));
  await expect(markers).toHaveCount(2);
});

test("loads smaller tiles where an area is too dense for one request", async ({ page }) => {
  // Tiles at the default zoom are ~0.35° wide; their smaller tiles are ~0.18°.
  const requests = await fakeChargersApi(page, { fullTilesWiderThan: 0.3 });
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText(/^\d+ EV chargers found$/);
  expect(requests.some((request) => tileWidth(request) < 0.3)).toBe(true);
});

test("says when only some chargers are shown", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await fakeChargersApi(page, { fullTilesWiderThan: 0 });
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText(
    /^Showing \d+ EV chargers, zoom in to see all$/
  );
});

test("reports a failed request", async ({ page }) => {
  await page.route("**/api/chargers/**", (route) => route.fulfill({ status: 500 }));
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("Could not load EV chargers");
});

test("groups nearby chargers when zoomed out", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(2);

  await page.evaluate(() => window.__fakeMap.setZoom(9));

  await expect(map.getByRole("button", { name: "2 EV chargers" })).toBeVisible();
  await expect(map.getByRole("button")).toHaveCount(1);
});

test("zooms in to split a group when it is clicked", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await page.evaluate(() => window.__fakeMap.setZoom(9));

  await map.getByRole("button", { name: "2 EV chargers" }).click();

  await expect(map.getByRole("button", { name: "Downtown Supercharger" })).toBeVisible();
  await expect(map.getByRole("button")).toHaveCount(2);
  expect(await page.evaluate(() => window.__fakeMap.zoom)).toBeGreaterThan(9);
});
