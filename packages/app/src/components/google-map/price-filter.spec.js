import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

// Far enough apart not to cluster; one per price level among them, and one
// without a per-kWh price to compare.
const charger = (id, name, [lat, lng], usageCost) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
  usageCost,
});

const chargers = [
  charger(1, "Cheap charger", [40.71, -74.0], "0,30 €/kWh"),
  charger(2, "Mid charger", [40.75, -73.95], "0,40 €/kWh"),
  charger(3, "Pricey charger", [40.79, -74.02], "0,50 €/kWh"),
  charger(4, "Unpriced charger", [40.68, -74.05], "parking fee applies"),
];

test.describe("filters", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page, { chargers });
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  });

  const shownChargers = (page) =>
    page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()).sort());

  test("shows only the chargers at the price levels on", async ({ page }) => {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    const price = filters.getByRole("group", { name: "Price" });
    await price.getByRole("button", { name: "Cheaper" }).click();
    await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
    expect(await shownChargers(page)).toEqual(["Cheap charger"]);

    // Levels add up; a charger without a comparable price is at none.
    await price.getByRole("button", { name: "Pricier" }).click();
    await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");
    expect(await shownChargers(page)).toEqual(["Cheap charger", "Pricey charger"]);
    await expect(
      page.getByRole("button", { name: "Filters", exact: true })
    ).toHaveAccessibleDescription("2 filters on");

    // Kept after a reload, as the other filters are.
    await filters.getByRole("button", { name: "Done" }).click();
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");

    // Clearing the filters shows them all again.
    await page.keyboard.press("c");
    await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  });
});
