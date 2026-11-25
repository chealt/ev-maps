import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";

const mapState = (page) =>
  page.evaluate(() => ({
    colorScheme: window.__fakeMap.options.colorScheme,
    center: window.__fakeMap.center,
    zoom: window.__fakeMap.zoom,
  }));

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await page.getByRole("button", { name: "Sign in" }).click();
});

test("follows the system theme, or the one chosen, kept after a reload, with the map where it was", async ({
  page,
}) => {
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "System" })).toBeChecked();
  expect((await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");

  // Dark: the map takes it, in the same place, with its chargers.
  const before = await mapState(page);
  await menu.getByRole("radio", { name: "Dark" }).check();
  await expect.poll(() => mapState(page)).toEqual({ ...before, colorScheme: "DARK" });
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(2);

  // Light, kept after a reload.
  await menu.getByRole("radio", { name: "Light" }).check();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect((await mapState(page)).colorScheme).toBe("LIGHT");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(menu.getByRole("radio", { name: "Light" })).toBeChecked();

  // Back to the system's, kept too.
  await menu.getByRole("radio", { name: "System" }).check();
  await expect.poll(async () => (await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect((await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");
});
