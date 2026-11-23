import { expect, test } from "@ev-maps/e2e/test.js";
import { TILE_FORMAT_VERSION } from "@ev-maps/tiles";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";
import {
  fakeChargersApi,
  fakeStatusApi,
  requestCovers,
  tileWidth,
} from "./fixtures/chargers-api.js";
import fixtureChargers from "./fixtures/chargers.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
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

test("asks for chargers in the current format", async ({ page }) => {
  const requests = await fakeChargersApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  for (const request of requests) {
    expect(request.searchParams.get("v")).toBe(String(TILE_FORMAT_VERSION));
  }
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

test(
  "zooms in to where chargers load from the zoom in warning",
  { tag: "@ui" },
  async ({ page }) => {
    await fakeChargersApi(page);
    await page.goto("/");
    const markers = page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button");
    await expect(markers).toHaveCount(2);
    await page.evaluate(() => window.__fakeMap.setZoom(5));

    // The warning is a button that zooms in, not the list's.
    const zoomIn = page.getByRole("button", { name: "Zoom in to see EV chargers" });
    await expect(zoomIn).toBeEnabled();
    await expect(zoomIn).not.toHaveAttribute("aria-haspopup");
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
  // The map exists once its chargers show.
  await expect(map.getByRole("button")).toHaveCount(2);
  await page.evaluate(() => window.__fakeMap.setZoom(9));

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
  await expect(details.getByRole("link", { name: "Open Charge Map" })).toBeVisible();
  await expect(details.getByRole("link", { name: "OpenStreetMap contributors" })).toBeVisible();
});

test("shows how many points are free, where the source says", async ({ page }) => {
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
      occupied: 0,
      outOfService: 1,
      total: 6,
      updatedAt: Date.now() - 3 * 60 * 1000,
    },
  });
  await page.goto("/");
  const map = page.getByRole("region", { name: "EV charging station map" });

  await map.getByRole("button", { name: "Downtown Supercharger" }).click();

  const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
  await expect(details.getByRole("heading", { name: "Availability" })).toBeVisible();
  await expect(details.getByText("5 of 6 points free")).toBeVisible();
  await expect(details.getByText("Out of service: 1")).toBeVisible();
  await expect(details.getByText("Updated 3 minutes ago")).toBeVisible();
  await expect(details.getByRole("link", { name: "EIPA" })).toBeVisible();
  // Only the sources with live statuses are asked for.
  expect(statusRequests).toEqual([["eipa:95424"]]);
});

test("asks for no availability where no source has it", async ({ page }) => {
  await fakeChargersApi(page);
  const statusRequests = await fakeStatusApi(page);
  await page.goto("/");
  const map = page.getByRole("region", { name: "EV charging station map" });

  await map.getByRole("button", { name: "Downtown Supercharger" }).click();

  const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
  await expect(details.getByText("Operator: Tesla")).toBeVisible();
  await expect(details.getByRole("heading", { name: "Availability" })).toBeHidden();
  expect(statusRequests).toHaveLength(0);
});

test("names a charger without a name after its operator", async ({ page }) => {
  const [downtown] = fixtureChargers;
  await fakeChargersApi(page, { chargers: [{ ...downtown, name: undefined }] });
  await page.goto("/");
  const map = page.getByRole("region", { name: "EV charging station map" });

  await expect(map.getByRole("button", { name: "Tesla" })).toBeVisible();
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
  await expect(details.getByRole("link", { name: "IRVE, transport.data.gouv.fr" })).toBeVisible();
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
