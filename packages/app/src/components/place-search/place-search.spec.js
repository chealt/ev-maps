import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page, { signedIn: true });
  await fakeChargersApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test("searches for a place and moves the map there", async ({ page }) => {
  await page.getByRole("button", { name: "Search" }).click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  const showButton = dialog.getByRole("button", { name: "Show on map" });
  await expect(showButton).toBeDisabled();

  await dialog.getByRole("combobox", { name: "Search" }).fill("Buda");
  await dialog.getByRole("option", { name: "Budapest, Hungary" }).click();
  await expect(showButton).toBeEnabled();

  await showButton.click();
  await expect(dialog).toBeHidden();
  const center = await page.evaluate(() => window.__fakeMap?.getCenter().toJSON());
  expect(center).toEqual({ lat: 47.4979, lng: 19.0402 });
});

test("searches for a place and adds it as the route's destination", async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Search" }).click();
  const dialog = page.getByRole("dialog", { name: "Search" });

  await dialog.getByRole("combobox", { name: "Search" }).fill("Vie");
  await dialog.getByRole("option", { name: "Vienna, Austria" }).click();
  await dialog.getByRole("button", { name: "Navigate" }).click();

  await expect(dialog).toBeHidden();
  const planner = page.getByRole("dialog", { name: "Plan a route" });
  await expect(planner).toBeVisible();
  await expect(planner.getByRole("combobox", { name: "To" })).toHaveValue("Vienna, Austria");

  await planner.getByRole("combobox", { name: "From" }).fill("Buda");
  await planner.getByRole("option", { name: "Budapest, Hungary" }).click();
  await planner.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
});
