import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "#fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "#fixtures/chargers-api.js";
import { fakeGoogleMaps } from "#fixtures/google.js";

const charger = {
  id: "ocm:1",
  source: "ocm",
  name: "Harbor charger",
  location: { lat: 40.7128, lng: -73.9 },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
};

const openHarbor = async (page) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: "Harbor charger" }).click();
  return page.getByRole("complementary", { name: "Harbor charger" });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers: [charger] });
  await fakeRouteChargersApi(page);
});

test(
  "plans a route to the charger from where the user is, when they allow it",
  { tag: "@ui" },
  async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    // Near the charger: allowed, the map opens on the user, close up.
    await context.setGeolocation({ latitude: 40.715, longitude: -73.905 });
    await fakeAuthApi(page, { signedIn: true });
    await page.goto("/");
    const details = await openHarbor(page);

    await details.getByRole("button", { name: "Navigate" }).click();

    // Planned here, not handed to another app.
    await expect(page.getByRole("status")).toHaveText(/along the route$/);
    await expect(page.getByRole("button", { name: "Clear route" })).toBeVisible();
    const [request] = await page.evaluate(() => window.__routeRequests);
    expect(request.origin).toEqual({ lat: 40.715, lng: -73.905 });
    expect(request.destination).toEqual({ lat: 40.7128, lng: -73.9 });
  }
);

test("asks where from when the location isn't allowed", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await page.goto("/");
  const details = await openHarbor(page);

  await details.getByRole("button", { name: "Navigate" }).click();

  const planner = page.getByRole("dialog", { name: "Plan a route" });
  await expect(planner).toBeVisible();
  await expect(planner.getByRole("combobox", { name: "To" })).toHaveValue("Harbor charger");
  await expect(planner.getByRole("combobox", { name: "From" })).toHaveValue("");
  expect(await page.evaluate(() => window.__routeRequests)).toEqual([]);
});

test("asks to sign in first, as routes need it", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  const details = await openHarbor(page);

  await details.getByRole("button", { name: "Navigate" }).click();

  const planner = page.getByRole("dialog", { name: "Plan a route" });
  await expect(planner.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(planner.getByRole("combobox", { name: "To" })).toHaveValue("Harbor charger");
});
