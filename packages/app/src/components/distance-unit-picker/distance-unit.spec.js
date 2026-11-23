import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// Planning routes needs a signed-in user. The fake route API puts the two
// fixture chargers 50 and 100 km along any route, 1 km off it.
const planRoute = async (page) => {
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  for (const [field, text, option] of [
    ["From", "Buda", "Budapest, Hungary"],
    ["To", "Vie", "Vienna, Austria"],
  ]) {
    await dialog.getByRole("combobox", { name: field }).fill(text);
    await dialog.getByRole("option", { name: option }).click();
  }
  await dialog.getByRole("button", { name: "Show route" }).click();
  await page.getByRole("button", { name: "2 EV chargers along the route" }).click();
  return page.getByRole("dialog", { name: "2 EV chargers" }).getByRole("listitem").first();
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page, { signedIn: true });
  await fakeChargersApi(page);
  await fakeRouteChargersApi(page);
});

test("shows kilometres where the locale uses them", async ({ page }) => {
  await fakeSettingsApi(page);
  await page.goto("/");
  const charger = await planRoute(page);
  await expect(charger).toContainText("50 km from the start100 km to the end1 km off the route");
});

test.describe("in a locale that uses miles", () => {
  test.use({ locale: "en-US" });

  test("shows miles, and feet when short", async ({ page }) => {
    await fakeSettingsApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Route" }).click();
    await expect(page.getByText("Chargers within 3.1 mi of the route are shown.")).toBeVisible();
    await page.getByRole("button", { name: "Close route planner" }).click();

    const charger = await planRoute(page);
    await expect(charger).toContainText("31 mi from the start62 mi to the end0.6 mi off the route");
  });
});

test("the unit chosen in the account menu shows at once, and is kept in the account", async ({
  page,
}) => {
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "Automatic" })).toBeChecked();
  await menu.getByRole("radio", { name: "Miles" }).check();
  await expect
    .poll(() => saves.map((save) => save.distanceUnit?.unit).filter(Boolean))
    .toEqual(["imperial"]);
  await page.locator('[popovertarget="account-menu"]').click();

  // The filters' "nearby" hint, built in metres, follows.
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByText("Within 490 ft, from OpenStreetMap.")).toBeVisible();
  await page.getByRole("button", { name: "Close filters" }).click();

  const charger = await planRoute(page);
  await expect(charger).toContainText("31 mi from the start");
});

test("takes the unit chosen on another device, from the account", async ({ page }) => {
  await fakeSettingsApi(page, { distanceUnit: { unit: "imperial", updatedAt: Date.now() } });
  await page.goto("/");
  const charger = await planRoute(page);
  await expect(charger).toContainText("31 mi from the start");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await expect(
    page.getByRole("dialog", { name: "Account" }).getByRole("radio", { name: "Miles" })
  ).toBeChecked();
});
