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

// Formatting in each unit, and the unit a locale uses, are unit tested
// (src/lib/distance.test.js).
test("takes the unit chosen on another device, shows one chosen here at once, and keeps it in the account", async ({
  page,
}) => {
  const saves = await fakeSettingsApi(page, {
    distanceUnit: { unit: "imperial", updatedAt: Date.now() },
  });
  await page.goto("/");
  const charger = await planRoute(page);
  await expect(charger.getByRole("img")).toHaveAccessibleName(/31 mi from the start/);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "Miles" })).toBeChecked();
  await menu.getByRole("radio", { name: "Kilometres" }).check();
  await expect
    .poll(() => saves.map((save) => save.distanceUnit?.unit).filter(Boolean))
    .toEqual(["metric"]);
  await page.locator('[popovertarget="account-menu"]').click();

  // The filters' "nearby" hint, built in metres, follows at once.
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByText("Within 150 m, from OpenStreetMap.")).toBeVisible();
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.getByRole("button", { name: "2 EV chargers along the route" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "2 EV chargers" })
      .getByRole("listitem")
      .first()
      .getByRole("img")
  ).toHaveAccessibleName(/50 km from the start/);
});
