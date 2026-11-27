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

test.describe("map", () => {
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

  test(
    "opens at the configured center, without locating the user, with the chargers' pins filtered in a Web Worker",
    { tag: ["@performance", "@regression"] },
    async ({ page }) => {
      const map = page.getByRole("region", { name: "EV charging station map" });
      await expect(map.getByRole("button")).toHaveCount(2);
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

      const options = await page.evaluate(() => window.__fakeMap.options);
      expect(options.mapId).toBe("TEST_MAP_ID");
      expect(await mapState(page)).toEqual({ center: { lat: 40.7128, lng: -74.006 }, zoom: 12 });
      expect(loadedChargersAround({ lat: 40.7128, lng: -74.006 })).toBe(true);
      expect(page.workers().map((worker) => worker.url())).toContainEqual(
        expect.stringContaining("charger-worker")
      );
    }
  );

  test(
    "shows charger details when a marker is clicked, as text, closed with Close or Escape",
    { tag: ["@ui", "@regression"] },
    async ({ page }, testInfo) => {
      const map = page.getByRole("region", { name: "EV charging station map" });
      await map.getByRole("button", { name: downtownChargerLabel, exact: true }).click();

      const details = page.getByRole("complementary", { name: downtownChargerLabel });
      await expect(details.getByRole("heading", { name: downtownChargerLabel })).toBeVisible();
      // The name heads the panel, with no label above it.
      await expect(details.getByText("EV charging", { exact: true })).toHaveCount(0);
      await expect(details.getByText("1 Main St, New York, NY, 10001")).toBeVisible();
      await expect(
        details.getByRole("button", { name: "CCS (Type 1): 4× · 150 kW" })
      ).toBeVisible();
      await expect(
        details.getByRole("button", { name: "NACS (Tesla): 4× · 250 kW" })
      ).toBeVisible();
      await expect(details.getByText("Operator: Tesla")).toBeVisible();
      await expect(details.getByText("Access: Public, membership required")).toBeVisible();
      await expect(details.getByText("Cost: $0.40/kWh")).toBeVisible();
      await expect(details.getByText("Status: Operational")).toBeVisible();
      await expect(details.getByText("Charging points: 8")).toBeVisible();
      // The address opens the charger in Google Maps, in a new tab.
      await expect(
        details.getByRole("link", { name: "1 Main St, New York, NY, 10001" })
      ).toHaveAttribute("target", "_blank");
      // No adding a stop without a route.
      await expect(details.getByRole("button", { name: "Navigate" })).toBeVisible();
      await expect(details.getByRole("button", { name: "Add stop" })).toBeHidden();
      await expect(
        details
          .getByRole("link", { name: "Charging data source" })
          .and(details.locator('[href="https://openchargemap.org"]'))
      ).toBeVisible();
      await captureUi(page, testInfo, "the charger's details");
      await details.getByRole("button", { name: "Close" }).click();
      await expect(page.getByRole("complementary")).toBeHidden();

      // Escape closes them, after a dialog open over them (the filters).
      await map.getByRole("button", { name: downtownChargerLabel, exact: true }).click();
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
      await expect(details).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(details).toBeHidden();

      // A charger's data is text, never HTML.
      await map.getByRole("button", { name: xssElement, exact: true }).click();
      await expect(page.getByRole("heading", { name: xssElement, exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    }
  );

  test.describe("with geolocation", () => {
    test.use({
      geolocation: { latitude: userLocation.lat, longitude: userLocation.lng },
      permissions: ["geolocation"],
    });

    test("locates the user on load, again with Locate Me, but not over where they left the map", async ({
      page,
    }) => {
      await expect.poll(() => mapState(page)).toEqual({ center: userLocation, zoom: 14 });
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      await expect.poll(() => loadedChargersAround(userLocation)).toBe(true);

      // Locate Me brings the map back to the user.
      await page.evaluate(() => window.__fakeMap.setCenter({ lat: 0, lng: 0 }));
      await page.getByRole("button", { name: "Locate Me" }).click();
      await expect.poll(() => mapState(page)).toEqual({ center: userLocation, zoom: 14 });

      // Left elsewhere, the map reopens there, not at the user.
      const newYork = { lat: 40.73, lng: -73.99 };
      await page.evaluate((center) => window.__fakeMap.setCenter(center), newYork);
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      expect(await mapState(page)).toEqual({ center: newYork, zoom: 14 });
    });
  });

  // An older version's saved location is unit tested (saved-state.test.js).
  test("reopens where the map was left, and says when the location is denied", async ({ page }) => {
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    const london = { lat: 51.5074, lng: -0.1278 };
    await page.evaluate((center) => {
      window.__fakeMap.setCenter(center);
      window.__fakeMap.setZoom(13);
    }, london);
    await expect.poll(() => loadedChargersAround(london)).toBe(true);
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) =>
        error({ code: 1, message: "" });
    });
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    expect(await mapState(page)).toEqual({ center: london, zoom: 13 });

    await page.getByRole("button", { name: "Locate Me" }).click();
    await expect(page.getByRole("status")).toHaveText("Location permission denied");
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

  test(
    "the filters open in a dialog that closes with Done, Close or Escape",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
      const dialog = page.getByRole("dialog", { name: "Filters" });
      await expect(dialog).toBeHidden();

      await filtersButton.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("group", { name: "Charging power" })).toBeVisible();
      await captureUi(page, testInfo, "the filters dialog open");
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

  test(
    "on mobile, the top row shows the status pill and the account box",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      await captureUi(page, testInfo, "the mobile top row, signed out");

      await fakeAuthApi(page, { signedIn: true });
      await page.reload();
      await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
      // Hidden for room, the name is still the page's heading.
      await expect(page.getByRole("heading", { level: 1, name: "EV Maps" })).toBeAttached();
      await captureUi(page, testInfo, "the mobile top row, signed in");
    }
  );

  test("shows the app's name once, as on Google's sign-in consent screen, in the account box", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1, name: "EV Maps" })).toBeVisible();
    await expect(page).toHaveTitle(/^EV Maps/);
    await expect(page.locator(".mark")).toHaveCount(1);

    // The account button lies over the name, so a click on the name is the
    // button's; force skips Playwright's check that the heading gets it.
    await page.getByRole("heading", { level: 1, name: "EV Maps" }).click({ force: true });
    await expect(page.getByRole("dialog", { name: "Account" })).toBeVisible();
  });
});
