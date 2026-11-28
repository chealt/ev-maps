import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

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

// West and a little north of the center, where even a short panel (top
// left, from about 80px down) covers its pin.
const west = charger(1, "West charger", [40.755, -74.16]);
const east = charger(2, "East charger", [40.7128, -73.9]);

const center = (page) => page.evaluate(() => window.__fakeMap.getCenter().toJSON());

test.describe("map", () => {
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

  test("a tap on the map closes the charger's details", async ({ page }) => {
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "East charger" }).click();
    const details = page.getByRole("complementary", { name: "East charger" });
    await expect(details).toBeVisible();

    await map.click({ position: { x: 700, y: 500 } });

    await expect(details).toBeHidden();
  });

  test("a tap on the map closes the account menu", async ({ page }) => {
    await page.locator('[popovertarget="account-menu"]').click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await expect(menu).toBeVisible();

    await page.getByRole("region", { name: "EV charging station map" }).click({
      position: { x: 700, y: 500 },
    });

    await expect(menu).toBeHidden();
  });

  test("a tap on the map closes the map's menu", async ({ page }) => {
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.click({ button: "right", position: { x: 700, y: 500 } });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    await map.click({ position: { x: 600, y: 400 } });

    await expect(menu).toBeHidden();
  });
});
