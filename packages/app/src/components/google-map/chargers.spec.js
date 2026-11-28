import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { TILE_FORMAT_VERSION } from "@ev-maps/tiles";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import {
  fakeChargersApi,
  fakeStatusApi,
  requestCovers,
} from "@ev-maps/e2e/fixtures/chargers-api.js";
import fixtureChargers from "@ev-maps/e2e/fixtures/chargers.json" with { type: "json" };

test.describe("map", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeAuthApi(page);
  });

  // Which tiles are asked for (the zoom, the format, splitting dense ones) is
  // unit tested in chargers.test.js.
  test(
    "loads the chargers of the visible area, and again where the map moves",
    { tag: "@regression" },
    async ({ page }) => {
      const requests = await fakeChargersApi(page);
      await page.goto("/");
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      expect(
        requests.some((request) => requestCovers(request, { lat: 40.7128, lng: -74.006 }))
      ).toBe(true);
      expect(
        requests.every((request) => request.searchParams.get("v") === String(TILE_FORMAT_VERSION))
      ).toBe(true);

      const london = { lat: 51.5074, lng: -0.1278 };
      await page.evaluate((center) => window.__fakeMap.setCenter(center), london);
      await expect
        .poll(() => requests.some((request) => requestCovers(request, london)))
        .toBe(true);
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    }
  );

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

    test("serves chargers from its cache, loads them again after a day, or uses the old ones offline", async ({
      page,
    }) => {
      const requests = await fakeChargersApi(page);
      await loadControlledPage(page);
      const requestCount = requests.length;

      // From the cache after a reload.
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      expect(requests).toHaveLength(requestCount);

      // Loaded again after a day.
      await ageCachedResponses(page);
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      expect(requests.length).toBeGreaterThan(requestCount);

      // A day old, without the network: the old ones.
      await ageCachedResponses(page);
      await page.context().unrouteAll();
      await page.context().route("**/api/chargers/**", (route) => route.abort());
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    });
  });

  test(
    "asks to zoom in where the area is too large, and zooms in to where chargers load",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeChargersApi(page);
      await page.goto("/");
      const markers = page
        .getByRole("region", { name: "EV charging station map" })
        .getByRole("button");
      await expect(markers).toHaveCount(2);
      await page.evaluate(() => window.__fakeMap.setZoom(5));
      await expect(markers).toHaveCount(0);

      // The warning is a button that zooms in, not the list's.
      const zoomIn = page.getByRole("button", { name: "Zoom in to see EV chargers" });
      await expect(zoomIn).toBeEnabled();
      await expect(zoomIn).not.toHaveAttribute("aria-haspopup");
      await captureUi(page, testInfo, "the zoom in warning");
      await zoomIn.click();

      // To the zoom where chargers load (appConfig's evChargers.minZoom).
      await expect.poll(() => page.evaluate(() => window.__fakeMap.getZoom())).toBe(9);
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      await expect(page.getByRole("button", { name: "2 EV chargers found" })).toHaveAttribute(
        "aria-haspopup",
        "dialog"
      );
    }
  );

  test("says when only some chargers are shown, or none could be loaded", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await fakeChargersApi(page, { fullTilesWiderThan: 0 });
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText(
      /^Showing \d+ EV chargers, zoom in to see all$/
    );

    await page.context().unrouteAll();
    await page.route("**/api/chargers/**", (route) => route.fulfill({ status: 500 }));
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("Could not load EV chargers");
  });

  test("groups nearby chargers when zoomed out, and splits a group when clicked", async ({
    page,
  }) => {
    await fakeChargersApi(page);
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });
    await expect(map.getByRole("button")).toHaveCount(2);

    await page.evaluate(() => window.__fakeMap.setZoom(9));
    await expect(map.getByRole("button")).toHaveCount(1);

    await map.getByRole("button", { name: "2 EV chargers" }).click();
    await expect(map.getByRole("button", { name: "Downtown Supercharger" })).toBeVisible();
    await expect(map.getByRole("button")).toHaveCount(2);
    expect(await page.evaluate(() => window.__fakeMap.zoom)).toBeGreaterThan(9);
  });

  test("credits every source of a charger merged from several", async ({ page }) => {
    const [downtown] = fixtureChargers;
    await fakeChargersApi(page, { chargers: [{ ...downtown, sources: ["ocm", "osm"] }] });
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });

    await map.getByRole("button", { name: "Downtown Supercharger" }).click();

    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    await expect(
      details
        .getByRole("link", { name: "Charging data source" })
        .and(details.locator('[href="https://openchargemap.org"]'))
    ).toBeVisible();
    await expect(
      details
        .getByRole("link", { name: "Charging data source" })
        .and(details.locator('[href="https://www.openstreetmap.org/copyright"]'))
    ).toBeVisible();
  });

  test(
    "shows how many points are free, where the source says",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page, { signedIn: true });
      const [downtown] = fixtureChargers;
      await fakeChargersApi(page, {
        chargers: [
          {
            ...downtown,
            id: "eipa:95424",
            source: "eipa",
            sources: ["eipa", "osm"],
            ids: ["eipa:95424", "osm:way/1"],
          },
        ],
      });
      const statusRequests = await fakeStatusApi(page, {
        "eipa:95424": {
          available: 5,
          occupied: 2,
          outOfService: 1,
          total: 8,
          updatedAt: Date.now() - 3 * 60 * 1000,
        },
      });
      await page.goto("/");
      const map = page.getByRole("region", { name: "EV charging station map" });

      await map.getByRole("button", { name: "Downtown Supercharger" }).click();

      const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
      await expect(details.getByRole("heading", { name: "Connectors" })).toBeVisible();
      await expect(details.getByText("5 of 8 points free")).toBeVisible();
      await expect(details.getByText("Out of service: 1")).toBeVisible();
      await expect(details.getByText("Updated 3 minutes ago")).toBeVisible();
      // With points free, occupied and out of service, the connector columns
      // and their point indicators wear green (free), yellow (occupied) and
      // red (out-of-service).
      await expect(details.locator(".connectors")).toHaveClass(/has-free/);
      await expect(details.locator('.connector-point[data-state="free"]')).toHaveCount(5);
      await expect(details.locator('.connector-point[data-state="occupied"]')).toHaveCount(2);
      await expect(details.locator('.connector-point[data-state="out-of-service"]')).toHaveCount(1);
      await expect(
        details
          .getByRole("link", { name: "Charging data source" })
          .and(details.locator('[href="https://eipa.udt.gov.pl"]'))
      ).toBeVisible();
      // Only the sources with live statuses are asked for.
      expect(statusRequests).toEqual([["eipa:95424"]]);
      await captureUi(
        page,
        testInfo,
        "connector columns with free, occupied and out-of-service points"
      );
    }
  );

  test(
    "shows connector columns across all availability states and connector types, with name on info hover",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page, { signedIn: true });
      const [downtown] = fixtureChargers;
      const multiConnectors = [
        { type: "ccs2", powerKw: 350, quantity: 3 },
        { type: "chademo", powerKw: 50, quantity: 2 },
        { type: "type2", powerKw: 22, quantity: 2 },
        { type: "nacs", powerKw: 250, quantity: 1 },
      ];
      await fakeChargersApi(page, {
        chargers: [
          {
            ...downtown,
            id: "eipa:1",
            source: "eipa",
            ids: ["eipa:1"],
            name: "Mixed Hub",
            location: { lat: 40.71, lng: -74.02 },
            connectors: multiConnectors,
          },
          {
            ...downtown,
            id: "eipa:2",
            source: "eipa",
            ids: ["eipa:2"],
            name: "Busy Hub",
            location: { lat: 40.72, lng: -74.0 },
            connectors: multiConnectors,
          },
          {
            ...downtown,
            id: "eipa:3",
            source: "eipa",
            ids: ["eipa:3"],
            name: "Broken Hub",
            location: { lat: 40.73, lng: -73.98 },
            connectors: multiConnectors,
          },
          {
            ...downtown,
            id: "ocm:4",
            source: "ocm",
            ids: ["ocm:4"],
            name: "Static Hub",
            location: { lat: 40.7, lng: -73.99 },
            connectors: multiConnectors,
          },
        ],
      });
      const now = Date.now() - 2 * 60 * 1000;
      await fakeStatusApi(page, {
        "eipa:1": { available: 4, occupied: 2, outOfService: 2, total: 8, updatedAt: now },
        "eipa:2": { available: 0, occupied: 8, outOfService: 0, total: 8, updatedAt: now },
        "eipa:3": { available: 0, occupied: 0, outOfService: 8, total: 8, updatedAt: now },
      });

      await page.goto("/");
      const map = page.getByRole("region", { name: "EV charging station map" });

      // 1. Mixed state: free (green), occupied (yellow), out-of-service (red),
      // with hover on the `i` info button revealing the connector name tooltip.
      await map.getByRole("button", { name: "Mixed Hub" }).click();
      const mixedDetails = page.getByRole("complementary", { name: "Mixed Hub" });
      await expect(mixedDetails.getByText("4 of 8 points free")).toBeVisible();
      const ccsInfo = mixedDetails.getByRole("button", { name: "CCS (Type 2): 3× · 350 kW" });
      // The bars show how many points there are, without a "3×" too (#380).
      await expect(mixedDetails.getByText("3×", { exact: true })).toBeHidden();
      // The mouse moved onto it, rather than hover(), whose retries under load
      // scroll the panel by more or less: the details stay at their top, the
      // same every run. It's in view there.
      await expect(ccsInfo).toBeInViewport();
      const info = await ccsInfo.boundingBox();
      await page.mouse.move(info.x + info.width / 2, info.y + info.height / 2);
      await expect(mixedDetails.getByRole("tooltip", { name: "CCS (Type 2)" })).toBeVisible();
      await captureUi(
        page,
        testInfo,
        "1. mixed availability (free green, occupied yellow, out-of-service red) with info tooltip hovered"
      );

      // 2. All occupied (yellow).
      await map.getByRole("button", { name: "Busy Hub, all points busy" }).click();
      const busyDetails = page.getByRole("complementary", { name: "Busy Hub" });
      await expect(busyDetails.getByText("0 of 8 points free")).toBeVisible();
      await expect(busyDetails.locator('.connector-point[data-state="occupied"]')).toHaveCount(8);
      await captureUi(page, testInfo, "2. all occupied (yellow)");

      // 3. All out-of-service / not working (red).
      await map.getByRole("button", { name: "Broken Hub, out of service" }).click();
      const brokenDetails = page.getByRole("complementary", { name: "Broken Hub" });
      await expect(brokenDetails.getByText("Out of service: 8")).toBeVisible();
      await expect(
        brokenDetails.locator('.connector-point[data-state="out-of-service"]')
      ).toHaveCount(8);
      await captureUi(page, testInfo, "3. all out-of-service / not working (red)");

      // 4. Unknown / static availability (grey points), with the caption
      // saying why they stay grey.
      await map.getByRole("button", { name: "Static Hub" }).click();
      const staticDetails = page.getByRole("complementary", { name: "Static Hub" });
      await expect(
        staticDetails.getByRole("button", { name: "CHAdeMO: 2× · 50 kW" })
      ).toBeVisible();
      await expect(staticDetails.getByText("No live status")).toHaveCount(4);
      await captureUi(page, testInfo, "4. static connectors without live status (grey, captioned)");

      // The live-colored cards don't show the caption.
      await map.getByRole("button", { name: "Mixed Hub" }).click();
      await expect(
        page.getByRole("complementary", { name: "Mixed Hub" }).getByText("No live status").first()
      ).toBeHidden();
    }
  );

  test("asks for no availability where no source has it", async ({ page }) => {
    await fakeChargersApi(page);
    const statusRequests = await fakeStatusApi(page);
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });

    await map.getByRole("button", { name: "Downtown Supercharger" }).click();

    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    await expect(details.getByText("Operator: Tesla")).toBeVisible();
    await expect(details.getByText("5 of 6 points free")).toBeHidden();
    expect(statusRequests).toHaveLength(0);
  });

  test("shows France's availability, crediting its register", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    const [downtown] = fixtureChargers;
    await fakeChargersApi(page, {
      chargers: [{ ...downtown, id: "irve:FRS1", source: "irve", ids: ["irve:FRS1"] }],
    });
    await fakeStatusApi(page, {
      "irve:FRS1": { available: 1, occupied: 1, outOfService: 0, total: 2, updatedAt: Date.now() },
    });
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });

    await map.getByRole("button", { name: "Downtown Supercharger" }).click();

    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    await expect(details.getByText("1 of 2 points free")).toBeVisible();
    await expect(details.getByText("Out of service")).toBeHidden();
    await expect(
      details
        .getByRole("link", { name: "Charging data source" })
        .and(details.locator('[href*="transport.data.gouv.fr"]'))
    ).toBeVisible();
  });

  test("asks to sign in for live availability", async ({ page }) => {
    const [downtown] = fixtureChargers;
    await fakeChargersApi(page, {
      chargers: [{ ...downtown, id: "eipa:95424", source: "eipa", ids: ["eipa:95424"] }],
    });
    const statusRequests = await fakeStatusApi(page, {
      "eipa:95424": { available: 5, occupied: 0, outOfService: 1, total: 6, updatedAt: Date.now() },
    });
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });

    await expect(
      details.getByText("Sign in to see how many points are free right now.")
    ).toBeVisible();
    await expect(details.getByText("5 of 6 points free")).toBeHidden();
    expect(statusRequests).toHaveLength(0);

    await details.getByRole("button", { name: "Sign in", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await menu.getByRole("button", { name: "Sign in with Google" }).click();

    // Back from signing in, the same charger shows its availability.
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    await expect(details.getByText("5 of 6 points free")).toBeVisible();
  });

  test(
    "opens the list of the chargers found from the status pill",
    { tag: "@ui" },
    async ({ page }) => {
      await fakeChargersApi(page);
      await page.goto("/");

      await page.getByRole("button", { name: "2 EV chargers found" }).click();

      const list = page.getByRole("dialog", { name: "2 EV chargers" });
      await expect(list).toBeVisible();
      await expect(list.getByRole("listitem")).toHaveCount(2);
    }
  );
});
