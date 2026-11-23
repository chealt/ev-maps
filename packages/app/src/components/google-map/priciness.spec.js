import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
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

test("reads prices written the European way, each compared within its currency", async ({
  page,
}) => {
  await fakeChargersApi(page, {
    chargers: [
      charger(1, "Euro cheap", [40.71, -74.0], "0,30€/kWh"),
      charger(2, "Euro pricey", [40.75, -73.95], "0,59 €/kWh Gleichstromaufladen"),
      charger(3, "Zloty cheap", [40.79, -74.02], "1.19 PLN/kWh"),
      charger(4, "Zloty pricey", [40.68, -74.05], "PLN 2.49/kWh"),
    ],
  });
  await page.reload();

  // Against the other euro price only, not the złoty ones.
  const euro = await openDetails(page, "Euro pricey");
  await expect(
    euro.getByText("Priciness: $$ (pricier than 50% of the chargers here)")
  ).toBeVisible();
  await euro.getByRole("button", { name: "Close" }).click();

  const zloty = await openDetails(page, "Zloty cheap");
  await expect(zloty.getByText("Priciness: $ (the cheapest of the chargers here)")).toBeVisible();
});

test("says how many it's cheaper than, not how many are cheaper", async ({ page }) => {
  // One price below the charger's, three above it.
  await fakeChargersApi(page, {
    chargers: [
      charger(1, "Cheapest", [40.71, -74.0], "£0.20/kWh"),
      charger(2, "Second", [40.75, -73.95], "£0.30/kWh"),
      charger(3, "Third", [40.79, -74.02], "£0.40/kWh"),
      charger(4, "Fourth", [40.68, -74.05], "£0.50/kWh"),
      charger(5, "Fifth", [40.73, -74.1], "£0.60/kWh"),
    ],
  });
  await page.reload();
  const second = await openDetails(page, "Second");
  await expect(second.getByText("cheaper than 60% of the chargers here")).toBeVisible();
});

test("shows each charger's priciness in the list along a route", async ({ page }) => {
  // Planning a route needs a signed-in user; the fake route API puts these
  // along it in order.
  await fakeAuthApi(page, { signedIn: true });
  await fakeRouteChargersApi(page, {
    chargers: [
      charger(1, "First stop", [0, 0], "0,49 €/kWh"),
      charger(2, "Second stop", [0, 0], "0,29€/kWh"),
      charger(3, "Third stop", [0, 0], "no price given"),
    ],
  });
  await page.reload();
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  for (const [field, text, option] of [
    ["From", "Buda", "Budapest, Hungary"],
    ["To", "Vie", "Vienna, Austria"],
  ]) {
    await dialog.getByRole("combobox", { name: field }).fill(text);
    await dialog.getByRole("option", { name: option }).click();
  }
  await dialog.getByRole("button", { name: "Show route" }).click();
  await page.getByRole("button", { name: "3 EV chargers along the route" }).click();

  const entries = page.getByRole("dialog", { name: "3 EV chargers" }).getByRole("listitem");
  await expect(entries.nth(0)).toContainText("Priciness: $$");
  await expect(entries.nth(1)).toContainText("Priciness: $");
  await expect(entries.nth(1)).not.toContainText("Priciness: $$");
  await expect(entries.nth(2)).not.toContainText("Priciness");
});
