import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, name, [lat, lng], powerKw) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: powerKw,
  connectors: powerKw ? [{ type: "CCS (Type 1)", powerKw, quantity: 1 }] : [],
});

const chargers = [
  charger(1, "Slow charger", [40.71, -74.0], 22),
  charger(2, "Fast charger", [40.75, -73.95], 100),
  charger(3, "Boundary charger", [40.79, -74.02], 150),
  charger(4, "Rapid charger", [40.68, -74.05], 250),
  charger(5, "Ultra charger", [40.73, -73.9], 350),
  charger(6, "Unknown power charger", [40.66, -73.97], null),
];

// Opens the filters, toggles the given power ranges and closes the dialog.
// The map is inert while the modal dialog is open, so it has to be closed
// before checking the map.
const togglePowerFilters = async (page, names) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  for (const name of names) {
    await dialog.getByRole("button", { name }).click();
  }
  await dialog.getByRole("button", { name: "Done" }).click();
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
});

// Which chargers each range matches (boundaries, combining ranges, chargers
// without power data) is unit tested in charger-index.test.js; this checks
// the dialog's choices reach the map, and the ways to undo them.
test("filters the map by power, clears from the map or the dialog, and keeps them after a reload", async ({
  page,
}) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: "Slow charger" }).click();
  await expect(page.getByRole("complementary", { name: "Slow charger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeHidden();

  // A charger filtered out closes its details.
  await togglePowerFilters(page, ["150–300 kW", "300+ kW"]);
  await expect(page.getByRole("status")).toHaveText("3 of 6 EV chargers match the filters");
  await expect(map.getByRole("button")).toHaveCount(3);
  await expect(map.getByRole("button", { name: "Ultra charger" })).toBeVisible();
  await expect(page.getByRole("complementary")).toBeHidden();

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("3 of 6 EV chargers match the filters");

  // Cleared from the map's toolbar…
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeHidden();

  // …or from the dialog.
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog.getByRole("button", { name: "300+ kW", pressed: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  await dialog.getByRole("button", { name: "< 50 kW" }).click();
  await expect(page.getByRole("status")).toHaveText("1 of 6 EV chargers match the filters");
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await expect(dialog.getByRole("button", { name: "< 50 kW", pressed: false })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
});
