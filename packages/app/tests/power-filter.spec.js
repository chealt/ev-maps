import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";
import { fakeOpenChargeMap } from "./fixtures/open-charge-map.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, title, location, powerKw) => ({
  ID: id,
  AddressInfo: { Title: title, Latitude: location[0], Longitude: location[1] },
  Connections: powerKw ? [{ ConnectionTypeID: 32, PowerKW: powerKw, Quantity: 1 }] : [],
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
  await fakeGoogleIdentity(page);
  await fakeOpenChargeMap(page, { chargers });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
});

test("shows every charger while no power filter is active", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  for (const name of ["< 50 kW", "50–150 kW", "150–300 kW", "300+ kW"]) {
    await expect(dialog.getByRole("button", { name, pressed: false })).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Done" }).click();

  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(6);
});

test("shows only chargers in an active power range", async ({ page }) => {
  await togglePowerFilters(page, ["< 50 kW"]);

  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(1);
  await expect(map.getByRole("button", { name: "Slow charger" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 of 6 EV chargers match the filters");
});

test("combines active power ranges", async ({ page }) => {
  await togglePowerFilters(page, ["150–300 kW", "300+ kW"]);

  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(3);
  for (const name of ["Boundary charger", "Rapid charger", "Ultra charger"]) {
    await expect(map.getByRole("button", { name })).toBeVisible();
  }
  await expect(map.getByRole("button", { name: "Unknown power charger" })).toBeHidden();
});

test("counts a charger on a range boundary in the higher range", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });

  await togglePowerFilters(page, ["50–150 kW"]);
  await expect(map.getByRole("button", { name: "Fast charger" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Boundary charger" })).toBeHidden();

  await togglePowerFilters(page, ["50–150 kW", "150–300 kW"]);
  await expect(map.getByRole("button", { name: "Boundary charger" })).toBeVisible();
});

test("shows every charger again when no power filter is active", async ({ page }) => {
  await togglePowerFilters(page, ["300+ kW"]);
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(1);

  await togglePowerFilters(page, ["300+ kW"]);

  await expect(map.getByRole("button")).toHaveCount(6);
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
});

test("clears the filters from the map", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeHidden();
  await togglePowerFilters(page, ["< 50 kW", "300+ kW"]);

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(page.getByRole("button", { name: "Clear filters" })).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog.getByRole("button", { name: "< 50 kW", pressed: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "300+ kW", pressed: false })).toBeVisible();
});

test("clears the filters from the dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog.getByRole("button", { name: "Clear filters" })).toBeDisabled();

  await dialog.getByRole("button", { name: "150–300 kW" }).click();
  await dialog.getByRole("button", { name: "Clear filters" }).click();

  await expect(dialog.getByRole("button", { name: "150–300 kW", pressed: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clear filters" })).toBeDisabled();
});

test("restores the filters after a reload", async ({ page }) => {
  await togglePowerFilters(page, ["150–300 kW"]);
  await expect(page.getByRole("status")).toHaveText("2 of 6 EV chargers match the filters");

  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 of 6 EV chargers match the filters");
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
});

test("closes the details of a charger that is filtered out", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: "Slow charger" }).click();
  await expect(page.getByRole("complementary", { name: "Slow charger" })).toBeVisible();

  await togglePowerFilters(page, ["300+ kW"]);

  await expect(page.getByRole("complementary")).toBeHidden();
});
