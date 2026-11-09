import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const fakeGoogleMaps = await readFile(new URL("./fixtures/fake-google-maps.js", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeGoogleMaps })
  );
  await page.goto("/");
});

test("initializes the map with the configured center and map ID", async ({ page }) => {
  await expect(page.locator("ev-google-map")).toBeVisible();
  await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");

  const options = await page.evaluate(() => window.__fakeMap.options);
  expect(options.center).toEqual({ lat: 40.7128, lng: -74.006 });
  expect(options.mapId).toBe("TEST_MAP_ID");
});

test("shows EV charger markers", async ({ page }) => {
  await expect(page.locator(".fake-marker")).toHaveCount(2);
  const [request] = await page.evaluate(() => window.__searchRequests);
  expect(request.includedTypes).toEqual(["electric_vehicle_charging_station"]);
  expect(request.locationRestriction.radius).toBe(5000);
});

test("shows charger details when a marker is clicked", async ({ page }) => {
  await page.locator(".fake-marker").first().click();

  const details = page.locator(".charger-details");
  await expect(details).toBeVisible();
  await expect(details.locator(".charger-details__name")).toHaveText("Downtown Supercharger");
  await expect(details.locator(".charger-details__address")).toHaveText("1 Main St, New York");
  await expect(details.locator(".charger-details__connectors")).toContainText(
    "CCS COMBO 2: 4× · up to 150 kW, 2 available"
  );
  await expect(details.locator(".charger-details__hours")).toContainText("Monday: Open 24 hours");

  await details.getByRole("button", { name: "Close" }).click();
  await expect(details).toBeHidden();
});

test("renders charger data as text, not HTML", async ({ page }) => {
  await page.locator(".fake-marker").nth(1).click();
  await expect(page.locator(".charger-details__name")).toHaveText(
    '<img src="x" onerror="window.__xss = true">'
  );
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

const USER_LOCATION = { lat: 47.4979, lng: 19.0402 };

async function mapState(page) {
  return page.evaluate(() => ({
    center: window.__fakeMap.center,
    zoom: window.__fakeMap.zoom,
    lastSearchCenter: window.__searchRequests.at(-1).locationRestriction.center,
  }));
}

test.describe("with geolocation", () => {
  test.use({
    geolocation: { latitude: USER_LOCATION.lat, longitude: USER_LOCATION.lng },
    permissions: ["geolocation"],
  });

  test("locates the user on load when permission is already granted", async ({ page }) => {
    await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
    await expect
      .poll(() => mapState(page))
      .toEqual({ center: USER_LOCATION, zoom: 14, lastSearchCenter: USER_LOCATION });
  });

  test("centers the map on the user and searches there", async ({ page }) => {
    await expect.poll(() => mapState(page)).toMatchObject({ center: USER_LOCATION });
    await page.evaluate(() => window.__fakeMap.setCenter({ lat: 0, lng: 0 }));

    await page.getByRole("button", { name: "Locate Me" }).click();

    await expect
      .poll(() => mapState(page))
      .toEqual({ center: USER_LOCATION, zoom: 14, lastSearchCenter: USER_LOCATION });
    await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
  });

  test("remembers the last location", async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ev-maps:last-location")))
      .toBe(JSON.stringify(USER_LOCATION));
  });
});

test("does not locate automatically without permission", async ({ page }) => {
  await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
  expect(await mapState(page)).toEqual({
    center: { lat: 40.7128, lng: -74.006 },
    zoom: 12,
    lastSearchCenter: { lat: 40.7128, lng: -74.006 },
  });
});

test("opens at the last known location", async ({ page }) => {
  await page.addInitScript((location) => {
    localStorage.setItem("ev-maps:last-location", JSON.stringify(location));
  }, USER_LOCATION);
  await page.reload();

  await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
  expect(await mapState(page)).toEqual({
    center: USER_LOCATION,
    zoom: 14,
    lastSearchCenter: USER_LOCATION,
  });
});

test.describe("with geolocation before the map is ready", () => {
  test.use({
    geolocation: { latitude: 47.4979, longitude: 19.0402 },
    permissions: ["geolocation"],
  });

  test("applies the location once the map initializes", async ({ page }) => {
    let releaseMapsScript;
    const mapsScriptReleased = new Promise((resolve) => {
      releaseMapsScript = resolve;
    });
    await page.unroute("https://maps.googleapis.com/maps/api/js?**");
    await page.route("https://maps.googleapis.com/maps/api/js?**", async (route) => {
      await mapsScriptReleased;
      await route.fulfill({ contentType: "text/javascript", body: fakeGoogleMaps });
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Locate Me" }).click();
    await expect(page.locator(".map-status")).toHaveText("Location: 47.4979, 19.0402");
    expect(await page.evaluate(() => window.__fakeMap)).toBeUndefined();

    releaseMapsScript();

    await expect(page.locator(".map-status")).toHaveText("2 EV chargers found");
    const map = await page.evaluate(() => ({
      center: window.__fakeMap.center,
      zoom: window.__fakeMap.zoom,
    }));
    expect(map).toEqual({ center: { lat: 47.4979, lng: 19.0402 }, zoom: 14 });
    const requests = await page.evaluate(() => window.__searchRequests);
    expect(requests.at(-1).locationRestriction.center).toEqual({ lat: 47.4979, lng: 19.0402 });
  });
});

test("reports a denied location permission", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1, message: "" });
  });
  await page.reload();
  await page.getByRole("button", { name: "Locate Me" }).click();
  await expect(page.locator(".map-status")).toHaveText("Location permission denied");
});

test("filters toggle the panel and charger visibility", async ({ page }) => {
  const filterButton = page.getByRole("button", { name: "Filters" });
  const panel = page.locator(".filter-panel");

  await expect(panel).toBeHidden();
  await filterButton.click();
  await expect(panel).toBeVisible();
  await expect(filterButton).toHaveAttribute("aria-expanded", "true");

  await expect(page.locator(".fake-marker")).toHaveCount(2);
  await panel.getByLabel("Show EV chargers").uncheck();
  await expect(page.locator(".fake-marker")).toHaveCount(0);

  await panel.getByLabel("Search radius").selectOption("10000");
  await panel.getByLabel("Show EV chargers").check();
  await expect(page.locator(".fake-marker")).toHaveCount(2);
  const requests = await page.evaluate(() => window.__searchRequests);
  expect(requests.at(-1).locationRestriction.radius).toBe(10000);
});
