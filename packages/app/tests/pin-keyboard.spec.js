import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

// Far enough apart that they aren't clustered at the default zoom, and
// listed south first, so the page's order isn't the reading order.
const charger = (id, name, [lat, lng]) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
});

const chargers = [
  charger(1, "South charger", [40.68, -74.0]),
  charger(2, "Middle east charger", [40.73, -73.95]),
  charger(3, "Middle west charger", [40.73, -74.05]),
  charger(4, "North charger", [40.78, -74.0]),
];

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
});

const pin = (page, name) =>
  page.getByRole("region", { name: "EV charging station map" }).getByRole("button", { name });

test("Tab moves between the pins in reading order", async ({ page }) => {
  await pin(page, "North charger").focus();

  await page.keyboard.press("Tab");
  await expect(pin(page, "Middle west charger")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(pin(page, "Middle east charger")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(pin(page, "South charger")).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(pin(page, "Middle east charger")).toBeFocused();

  // Past the last pin, Tab goes on to the rest of the page.
  await pin(page, "South charger").focus();
  await page.keyboard.press("Tab");
  for (const name of [
    "North charger",
    "Middle west charger",
    "Middle east charger",
    "South charger",
  ]) {
    await expect(pin(page, name)).not.toBeFocused();
  }
});

test("Enter on a focused pin opens its details", async ({ page }) => {
  await pin(page, "North charger").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("complementary", { name: "Middle west charger" })).toBeVisible();
});
