import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const fakeGoogleMaps = await readFile(new URL("./fixtures/fake-google-maps.js", import.meta.url));

const downtownChargerLabel = "Downtown Supercharger";
const xssElement = '<img src="x" onerror="window.__xss = true">';

test.beforeEach(async ({ page }) => {
  await page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeGoogleMaps })
  );
  await page.goto("/");
});

test("initializes the map with the configured center and map ID", async ({ page }) => {
  await expect(page.getByRole("region", { name: "EV charging station map" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  const options = await page.evaluate(() => window.__fakeMap.options);
  expect(options.center).toEqual({ lat: 40.7128, lng: -74.006 });
  expect(options.mapId).toBe("TEST_MAP_ID");
});

test("shows EV charger markers", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(2);
  const [request] = await page.evaluate(() => window.__searchRequests);
  expect(request.includedTypes).toEqual(["electric_vehicle_charging_station"]);
  expect(request.locationRestriction.radius).toBe(5000);
});

test("shows charger details when a marker is clicked", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: downtownChargerLabel, exact: true }).click();

  const details = page.getByRole("complementary", { name: downtownChargerLabel });
  await expect(details).toBeVisible();
  await expect(details.getByRole("heading", { name: downtownChargerLabel })).toBeVisible();
  await expect(details.getByText("1 Main St, New York")).toBeVisible();
  await expect(details.getByText("CCS COMBO 2: 4× · up to 150 kW, 2 available")).toBeVisible();
  await expect(details.getByText("Monday: Open 24 hours")).toBeVisible();

  await details.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("complementary")).toBeHidden();
});

test("renders charger data as text, not HTML", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: xssElement, exact: true }).click();
  await expect(page.getByRole("heading", { name: xssElement, exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

const USER_LOCATION = { lat: 47.4979, lng: 19.0402 };

const mapState = async (page) => {
  return page.evaluate(() => ({
    center: window.__fakeMap.center,
    zoom: window.__fakeMap.zoom,
    lastSearchCenter: window.__searchRequests.at(-1).locationRestriction.center,
  }));
};

test.describe("with geolocation", () => {
  test.use({
    geolocation: { latitude: USER_LOCATION.lat, longitude: USER_LOCATION.lng },
    permissions: ["geolocation"],
  });

  test("locates the user on load when permission is already granted", async ({ page }) => {
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
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
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  });

  test("remembers the last location", async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ev-maps:last-location")))
      .toBe(JSON.stringify(USER_LOCATION));
  });
});

test("does not locate automatically without permission", async ({ page }) => {
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
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

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
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
    await expect(page.getByRole("status")).toHaveText("Location: 47.4979, 19.0402");
    expect(await page.evaluate(() => window.__fakeMap)).toBeUndefined();

    releaseMapsScript();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
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
  await expect(page.getByRole("status")).toHaveText("Location permission denied");
});

test("filters toggle the panel and charger visibility", async ({ page }) => {
  const markers = page.getByRole("region", { name: "EV charging station map" }).getByRole("button");
  const filterButton = page.getByRole("button", { name: "Filters" });
  const showChargers = page.getByLabel("Show EV chargers");
  const searchRadius = page.getByLabel("Search radius");

  await expect(showChargers).toBeHidden();
  await filterButton.click();
  await expect(showChargers).toBeVisible();
  await expect(page.getByRole("button", { name: "Filters", expanded: true })).toBeVisible();

  await expect(markers).toHaveCount(2);
  await showChargers.uncheck();
  await expect(markers).toHaveCount(0);

  await searchRadius.selectOption("10000");
  await showChargers.check();
  await expect(markers).toHaveCount(2);
  const requests = await page.evaluate(() => window.__searchRequests);
  expect(requests.at(-1).locationRestriction.radius).toBe(10000);
});
