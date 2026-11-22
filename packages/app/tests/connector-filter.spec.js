import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";
import { fakeSettingsApi } from "./fixtures/settings-api.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, name, [lat, lng], connectors) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: Math.max(0, ...connectors.map((connector) => connector.powerKw)) || null,
  connectors,
});

const chargers = [
  charger(1, "CCS hub", [40.71, -74.0], [{ type: "ccs2", powerKw: 150, quantity: 2 }]),
  charger(2, "CHAdeMO post", [40.75, -73.95], [{ type: "chademo", powerKw: 50, quantity: 1 }]),
  charger(
    3,
    "Mall",
    [40.79, -74.02],
    [
      { type: "type2-socket", powerKw: 22, quantity: 4 },
      { type: "ccs2", powerKw: 50, quantity: 1 },
    ]
  ),
  charger(4, "Unknown connectors", [40.68, -74.05], []),
];

const openFilters = async (page) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  return page.getByRole("dialog", { name: "Filters" });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers });
});

test("filters chargers by connector type", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");

  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "CCS hub" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Mall" })).toBeVisible();
  await expect(map.getByRole("button", { name: "CHAdeMO post" })).toBeHidden();
});

test("shows chargers with any of the chosen types, and the power filter too", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFilters(page);

  await dialog.getByRole("button", { name: "CHAdeMO" }).click();
  await dialog.getByRole("button", { name: "Type 2" }).click();
  await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");

  await dialog.getByRole("button", { name: "< 50 kW" }).click();
  await expect(page.getByRole("status")).toHaveText("0 of 4 EV chargers match the filters");
});

test("restores the connector types after a reload", async ({ page }) => {
  await page.goto("/");
  let dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CHAdeMO" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await page.reload();

  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: "CHAdeMO", pressed: true })).toBeVisible();
});

test("asks to sign in to keep the filters on every device", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: "Save to my account" })).toHaveCount(0);
  await expect(dialog.getByText("Sign in to keep your filters on all your devices.")).toBeVisible();

  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(dialog).toBeHidden();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("saves the filters to the account as they change when signed in", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const dialog = await openFilters(page);
  await expect(dialog.getByText("Sign in to keep your filters")).toBeHidden();

  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "150–300 kW" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  // Both changes in one request, sent as the dialog closes.
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].filters).toMatchObject({ connectorTypes: ["ccs"], powerRanges: ["150-300"] });
  expect(saves[0].filters.updatedAt).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves[1].filters).toMatchObject({ connectorTypes: [], powerRanges: [] });
});

test("says when the filters couldn't be saved to the account", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page);
  await page.route("**/api/settings", (route) =>
    route.request().method() === "PUT" ? route.fulfill({ status: 500 }) : route.fallback()
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const dialog = await openFilters(page);

  await dialog.getByRole("button", { name: "CCS" }).click();

  await expect(
    dialog.getByText("Your filters couldn't be saved to your account.", { exact: false })
  ).toBeVisible();
});

test("saves this device's filters to the account when they're newer", async ({ page }) => {
  await page.goto("/");
  let dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "Type 1" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page, {
    filters: { connectorTypes: ["chademo"], powerRanges: [], updatedAt: 1 },
  });
  await page.reload();

  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].filters.connectorTypes).toEqual(["type1"]);
  dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: "Type 1", pressed: true })).toBeVisible();
});

test("applies the account's newer filters after signing in", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page, {
    filters: { connectorTypes: ["chademo"], powerRanges: [], updatedAt: Date.now() },
  });

  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  const dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: "CHAdeMO", pressed: true })).toBeVisible();
});

test("shows on the Filters button how many filters are on", async ({ page }) => {
  await page.goto("/");
  const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
  const badge = filtersButton.locator(".badge");
  await expect(badge).toBeHidden();
  await expect(filtersButton).toHaveAccessibleDescription("");

  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "50–150 kW" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(badge).toHaveText("2");
  await expect(filtersButton).toHaveAccessibleDescription("2 filters on");

  await page.reload();
  await expect(badge).toHaveText("2");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(badge).toBeHidden();
  await expect(filtersButton).toHaveAccessibleDescription("");
});
