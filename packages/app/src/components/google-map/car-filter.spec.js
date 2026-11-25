import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

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
  charger(3, "Mall", [40.79, -74.02], [{ type: "type2-socket", powerKw: 22, quantity: 4 }]),
];

const openFilters = async (page) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  return page.getByRole("dialog", { name: "Filters" });
};

const openAccountMenu = async (page) => {
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  return page.getByRole("dialog", { name: "Account" });
};

// The car setting, as the account keeps it.
const savedCar = (page) =>
  page.evaluate(async () => (await (await fetch("/api/settings")).json()).settings?.car);

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page);
  await fakeChargersApi(page, { chargers });
});

test("filters chargers by the car's connectors when the automatic filter is on", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("3 EV chargers found");

  const menu = await openAccountMenu(page);
  await menu.getByRole("checkbox", { name: "CCS" }).check();
  await menu.getByRole("checkbox", { name: "Filter chargers automatically" }).check();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("status")).toHaveText("1 of 3 EV chargers match the filters");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "CCS hub" })).toBeVisible();
  await expect(map.getByRole("button", { name: "CHAdeMO post" })).toBeHidden();
  // Saved to the account, for the other devices.
  expect(await savedCar(page)).toMatchObject({ connectors: ["ccs"], autoFilter: true });

  // And after a reload, without touching the filter dialog.
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("1 of 3 EV chargers match the filters");

  // Turning the automatic filter off stops forcing the car's connectors:
  // the filter the user can then change freely, and it stays changed.
  const reopened = await openAccountMenu(page);
  await reopened.getByRole("checkbox", { name: "Filter chargers automatically" }).uncheck();
  await page.keyboard.press("Escape");

  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("status")).toHaveText("3 EV chargers found");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("3 EV chargers found");
});

test("the filter dialog's My car button selects the car's connectors", async ({ page }) => {
  await page.goto("/");
  const menu = await openAccountMenu(page);
  await menu.getByRole("checkbox", { name: "CCS" }).check();
  await menu.getByRole("checkbox", { name: "Type 2" }).check();
  await page.keyboard.press("Escape");

  const dialog = await openFilters(page);
  const myCar = dialog.getByRole("button", { name: "My car" });
  await expect(myCar).toBeVisible();
  await myCar.click();

  await expect(page.getByRole("status")).toHaveText("2 of 3 EV chargers match the filters");
  await expect(dialog.getByRole("button", { name: "CCS" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Type 2" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(dialog.getByRole("button", { name: "CHAdeMO" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
});

test("the My car button is hidden until the car has connectors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("3 EV chargers found");

  const dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: "My car" })).toBeHidden();
  await page.keyboard.press("Escape");

  const menu = await openAccountMenu(page);
  await menu.getByRole("checkbox", { name: "CHAdeMO" }).check();
  await page.keyboard.press("Escape");

  const reopened = await openFilters(page);
  await expect(reopened.getByRole("button", { name: "My car" })).toBeVisible();
});
