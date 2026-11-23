import { readFile } from "node:fs/promises";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, requestCovers } from "@ev-maps/e2e/fixtures/chargers-api.js";

const fakeGoogleMaps = await readFile(
  new URL("../../../../e2e/fixtures/fake-google-maps.js", import.meta.url)
);

const downtownChargerLabel = "Downtown Supercharger";
const xssElement = '<img src="x" onerror="window.__xss = true">';
const userLocation = { lat: 47.4979, lng: 19.0402 };

let chargerRequests;

test.beforeEach(async ({ page }) => {
  await page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeGoogleMaps })
  );
  await fakeAuthApi(page);
  chargerRequests = await fakeChargersApi(page);
  await page.goto("/");
});

// The map's center and zoom, or null until the map is created: the page's
// scripts wait for their messages first (src/lib/messages.js).
const mapState = (page) =>
  page.evaluate(() =>
    window.__fakeMap ? { center: window.__fakeMap.center, zoom: window.__fakeMap.zoom } : null
  );

const loadedChargersAround = (location) =>
  chargerRequests.some((request) => requestCovers(request, location));

test("filters and clusters the chargers in a Web Worker, off the main thread", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: downtownChargerLabel, exact: true })).toBeVisible();

  expect(page.workers().map((worker) => worker.url())).toContainEqual(
    expect.stringContaining("charger-worker")
  );
});

test("initializes the map with the configured center and map ID", async ({ page }) => {
  await expect(page.getByRole("region", { name: "EV charging station map" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  const options = await page.evaluate(() => window.__fakeMap.options);
  expect(options.center).toEqual({ lat: 40.7128, lng: -74.006 });
  expect(options.mapId).toBe("TEST_MAP_ID");
});

test("shows EV charger markers", { tag: ["@performance", "@regression"] }, async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(2);
});

test(
  "shows charger details when a marker is clicked",
  { tag: ["@ui", "@regression"] },
  async ({ page }, testInfo) => {
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: downtownChargerLabel, exact: true }).click();

    const details = page.getByRole("complementary", { name: downtownChargerLabel });
    await expect(details).toBeVisible();
    await expect(details.getByRole("heading", { name: downtownChargerLabel })).toBeVisible();
    // The name heads the panel, with no label above it.
    await expect(details.getByText("EV charging", { exact: true })).toHaveCount(0);
    await expect(details.getByText("1 Main St, New York, NY, 10001")).toBeVisible();
    await expect(details.getByText("CCS (Type 1): 4× · 150 kW")).toBeVisible();
    await expect(details.getByText("NACS (Tesla): 4× · 250 kW")).toBeVisible();
    await expect(details.getByText("Operator: Tesla")).toBeVisible();
    await expect(details.getByText("Access: Public, membership required")).toBeVisible();
    await expect(details.getByText("Cost: $0.40/kWh")).toBeVisible();
    await expect(details.getByText("Status: Operational")).toBeVisible();
    await expect(details.getByText("Charging points: 8")).toBeVisible();
    await expect(details.getByRole("link", { name: "Open Charge Map" })).toBeVisible();
    await captureUi(page, testInfo, "the charger's details");

    await details.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("complementary")).toBeHidden();
  }
);

test("the Escape key closes the charger details", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: downtownChargerLabel, exact: true }).click();
  const details = page.getByRole("complementary", { name: downtownChargerLabel });
  await expect(details).toBeVisible();

  // With a dialog open (the filters), Escape closes that instead.
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
  await expect(details).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
});

test("renders charger data as text, not HTML", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: xssElement, exact: true }).click();
  await expect(page.getByRole("heading", { name: xssElement, exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test.describe("with geolocation", () => {
  test.use({
    geolocation: { latitude: userLocation.lat, longitude: userLocation.lng },
    permissions: ["geolocation"],
  });

  test("locates the user on load when permission is already granted", async ({ page }) => {
    await expect.poll(() => mapState(page)).toEqual({ center: userLocation, zoom: 14 });
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    await expect.poll(() => loadedChargersAround(userLocation)).toBe(true);
  });

  test("centers the map on the user and loads chargers there", async ({ page }) => {
    await expect.poll(() => mapState(page)).toMatchObject({ center: userLocation });
    await page.evaluate(() => window.__fakeMap.setCenter({ lat: 0, lng: 0 }));
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

    await page.getByRole("button", { name: "Locate Me" }).click();

    await expect.poll(() => mapState(page)).toEqual({ center: userLocation, zoom: 14 });
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  });

  test("doesn't locate the user over where they left the map", async ({ page }) => {
    await expect.poll(() => mapState(page)).toMatchObject({ center: userLocation });
    const newYork = { lat: 40.73, lng: -73.99 };
    await page.evaluate((center) => window.__fakeMap.setCenter(center), newYork);
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

    await page.reload();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    expect(await mapState(page)).toEqual({ center: newYork, zoom: 14 });
  });
});

test("does not locate automatically without permission", async ({ page }) => {
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(await mapState(page)).toEqual({ center: { lat: 40.7128, lng: -74.006 }, zoom: 12 });
  expect(loadedChargersAround({ lat: 40.7128, lng: -74.006 })).toBe(true);
});

test("reopens where the map was left", async ({ page }) => {
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  const london = { lat: 51.5074, lng: -0.1278 };
  await page.evaluate((center) => {
    window.__fakeMap.setCenter(center);
    window.__fakeMap.setZoom(13);
  }, london);
  await expect.poll(() => loadedChargersAround(london)).toBe(true);
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(await mapState(page)).toEqual({ center: london, zoom: 13 });
});

test("opens at the location saved by an older version", async ({ page }) => {
  await page.addInitScript((location) => {
    localStorage.setItem("ev-maps:last-location", JSON.stringify(location));
  }, userLocation);
  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(await mapState(page)).toEqual({ center: userLocation, zoom: 14 });
  expect(loadedChargersAround(userLocation)).toBe(true);
});

test.describe("with geolocation before the map is ready", () => {
  test.use({
    geolocation: { latitude: userLocation.lat, longitude: userLocation.lng },
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
    expect(await mapState(page)).toEqual({ center: userLocation, zoom: 14 });
    await expect.poll(() => loadedChargersAround(userLocation)).toBe(true);
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

test(
  "the filters open in a dialog that closes with Done, Close or Escape",
  { tag: "@ui" },
  async ({ page }) => {
    const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeHidden();

    await filtersButton.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Charging power" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filters", expanded: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters", expanded: false })).toBeVisible();

    await filtersButton.click();
    await dialog.getByRole("button", { name: "Close filters" }).click();
    await expect(dialog).toBeHidden();

    await filtersButton.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters", expanded: false })).toBeVisible();
  }
);

test("shows the app's name, as on Google's sign-in consent screen", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "EV Maps" })).toBeVisible();
  await expect(page).toHaveTitle(/^EV Maps/);
});

test("shows the app's name once, in the account box, which opens the menu", async ({ page }) => {
  await expect(page.locator(".mark")).toHaveCount(1);

  // The account button lies over the name, so a click on the name is the
  // button's; force skips Playwright's check that the heading gets it.
  await page.getByRole("heading", { level: 1, name: "EV Maps" }).click({ force: true });

  await expect(page.getByRole("dialog", { name: "Account" })).toBeVisible();
});
