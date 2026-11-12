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

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
  await fakeOpenChargeMap(page, { chargers });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
  await page.getByRole("button", { name: "Filters" }).click();
});

test("shows every charger while no power filter is active", async ({ page }) => {
  const power = page.getByRole("group", { name: "Charging power" });
  for (const name of ["Under 50 kW", "50–150 kW", "150–300 kW", "300 kW and above"]) {
    await expect(power.getByRole("button", { name, pressed: false })).toBeVisible();
  }
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(6);
});

test("shows only chargers in an active power range", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });

  await page.getByRole("button", { name: "Under 50 kW" }).click();

  await expect(page.getByRole("button", { name: "Under 50 kW", pressed: true })).toBeVisible();
  await expect(map.getByRole("button")).toHaveCount(1);
  await expect(map.getByRole("button", { name: "Slow charger" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 of 6 EV chargers match the filters");
});

test("combines active power ranges", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });

  await page.getByRole("button", { name: "150–300 kW" }).click();
  await page.getByRole("button", { name: "300 kW and above" }).click();

  await expect(map.getByRole("button")).toHaveCount(3);
  for (const name of ["Boundary charger", "Rapid charger", "Ultra charger"]) {
    await expect(map.getByRole("button", { name })).toBeVisible();
  }
  await expect(map.getByRole("button", { name: "Unknown power charger" })).toBeHidden();
});

test("counts a charger on a range boundary in the higher range", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });

  await page.getByRole("button", { name: "50–150 kW" }).click();
  await expect(map.getByRole("button", { name: "Fast charger" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Boundary charger" })).toBeHidden();

  await page.getByRole("button", { name: "50–150 kW" }).click();
  await page.getByRole("button", { name: "150–300 kW" }).click();
  await expect(map.getByRole("button", { name: "Boundary charger" })).toBeVisible();
});

test("shows every charger again when no power filter is active", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await page.getByRole("button", { name: "300 kW and above" }).click();
  await expect(map.getByRole("button")).toHaveCount(1);

  await page.getByRole("button", { name: "300 kW and above" }).click();

  await expect(
    page.getByRole("button", { name: "300 kW and above", pressed: false })
  ).toBeVisible();
  await expect(map.getByRole("button")).toHaveCount(6);
  await expect(page.getByRole("status")).toHaveText("6 EV chargers found");
});

test("closes the details of a charger that is filtered out", async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await page.getByRole("button", { name: "Filters" }).click();
  await map.getByRole("button", { name: "Slow charger" }).click();
  await expect(page.getByRole("complementary", { name: "Slow charger" })).toBeVisible();

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("button", { name: "300 kW and above" }).click();

  await expect(page.getByRole("complementary")).toBeHidden();
});
