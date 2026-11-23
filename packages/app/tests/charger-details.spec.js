import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

// The map opens at New York (40.7128, -74.006), zoom 12. On a wide screen the
// details open on the left: the west charger's pin is under them, the east
// one's is clear of them.
const charger = (id, name, [lat, lng]) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
});

const west = charger(1, "West charger", [40.7128, -74.16]);
const east = charger(2, "East charger", [40.7128, -73.9]);

const center = (page) => page.evaluate(() => window.__fakeMap.getCenter().toJSON());

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers: [west, east] });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test("moves the map so the details don't cover the charger's pin", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  const before = await center(page);

  await map.getByRole("button", { name: "West charger" }).click();

  await expect(page.getByRole("complementary", { name: "West charger" })).toBeVisible();
  // The map moved west, towards the charger, so its pin is clear of the panel.
  await expect.poll(async () => (await center(page)).lng).toBeLessThan(before.lng);
});

test("leaves the map as it is when the pin is clear of the details", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  const before = await center(page);

  await map.getByRole("button", { name: "East charger" }).click();

  await expect(page.getByRole("complementary", { name: "East charger" })).toBeVisible();
  expect(await center(page)).toEqual(before);
});
