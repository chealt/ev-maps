import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

// Charged per kWh, close enough together to load on one map and not cluster
// apart... they need distinct spots; far enough apart not to cluster.
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
  charger(1, "Cheap charger", [40.71, -74.0], "$0.30/kWh"),
  charger(2, "Mid charger", [40.75, -73.95], "$0.40/kWh"),
  charger(3, "Pricey charger", [40.79, -74.02], "$0.50/kWh"),
  charger(4, "Unpriced charger", [40.68, -74.05], "parking fee applies"),
];

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers });
  await page.goto("/");
});

const openDetails = async (page, name) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: name, exact: true }).click();
  return page.getByRole("complementary", { name });
};

test("shows where a charger's price sits among the loaded ones", async ({ page }) => {
  const pricey = await openDetails(page, "Pricey charger");
  await expect(pricey.getByText("Priciness: $$$")).toBeVisible();
  await expect(pricey.getByText("pricier than 67% of the chargers here")).toBeVisible();
  await pricey.getByRole("button", { name: "Close" }).click();

  const mid = await openDetails(page, "Mid charger");
  await expect(mid.getByText("Priciness: $$")).toBeVisible();
  await expect(mid.getByText("cheaper than 33% of the chargers here")).toBeVisible();
  await mid.getByRole("button", { name: "Close" }).click();

  const cheap = await openDetails(page, "Cheap charger");
  await expect(cheap.getByText("Priciness: $")).toBeVisible();
  await expect(cheap.getByText("the cheapest of the chargers here")).toBeVisible();

  // A cost without a per-kWh price has nothing to compare.
  const unpriced = await openDetails(page, "Unpriced charger");
  await expect(unpriced.getByText("Priciness:")).toBeHidden();
  await expect(unpriced.getByText("Cost: parking fee applies")).toBeVisible();
});
