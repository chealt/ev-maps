import { expect, test } from "@playwright/test";
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

test("asks to sign in to save the filters to the account", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFilters(page);
  const save = dialog.getByRole("button", { name: "Save to my account" });

  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toHaveAccessibleDescription("Sign in to save your filters to your account");
  await save.hover();
  await expect(dialog.getByRole("tooltip")).toHaveText(
    "Sign in to save your filters to your account"
  );

  // aria-disabled, not disabled, so pressing it can open the sign-in options;
  // Playwright waits for aria-disabled buttons unless forced.
  await save.click({ force: true });

  await expect(dialog).toBeHidden();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("saves the filters to the account when signed in", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "150–300 kW" }).click();

  await dialog.getByRole("button", { name: "Save to my account" }).click();

  await expect(dialog.getByText("Saved to your account")).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0].filters).toMatchObject({ connectorTypes: ["ccs"], powerRanges: ["150-300"] });
  expect(saves[0].filters.updatedAt).toBeGreaterThan(0);
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

test("keeps this device's filters when they're newer than the account's", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page, {
    filters: { connectorTypes: ["chademo"], powerRanges: [], updatedAt: 1 },
  });
  await page.goto("/");
  // This device has no filters yet, so the account's apply first.
  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CHAdeMO" }).click();
  await dialog.getByRole("button", { name: "Type 2" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await page.reload();

  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Filters" })
      .getByRole("button", { name: "Type 2", pressed: true })
  ).toBeVisible();
});
