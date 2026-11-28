import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeStatusApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const charger = (id, name, [lat, lng]) => ({
  id,
  source: id.split(":")[0],
  ids: [id],
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 2 }],
});

const chargers = [
  charger("eipa:1", "Rondo station", [40.71, -74.0]),
  charger("ocm:4", "Station without prices", [40.68, -74.05]),
];

// As the Worker's history (packages/worker/src/charger-prices.js): cheaper
// at night, pricier in the evening and on Sundays, and pricier now.
const byHour = Array.from({ length: 24 }, (_, hour) => {
  if (hour >= 22 || hour < 6) {
    return 2;
  }
  return hour >= 17 && hour < 19 ? 3 : 2.5;
});
const history = {
  id: "eipa:1",
  unit: "PLN/kWh",
  timeZone: "Europe/Warsaw",
  from: Date.UTC(2026, 10, 1),
  to: Date.UTC(2026, 10, 30),
  hours: [],
  changes: [],
  usual: 2.5,
  min: 2,
  max: 3,
  current: 3,
  currentLevel: "higher",
  pricedHours: 720,
  byHour,
  byWeekday: [2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 3],
  cheapHours: [{ from: 22, to: 6 }],
  expensiveHours: [{ from: 17, to: 19 }],
  cheapDays: [],
  expensiveDays: [6],
};

const fakePricesApi = async (page) => {
  const requests = [];
  await page.route("**/api/chargers/prices?*", (route) => {
    const ids = new URL(route.request().url()).searchParams.get("ids").split(",");
    requests.push(ids);
    return route.fulfill({ json: { history: ids.includes("eipa:1") ? history : null } });
  });
  return requests;
};

test.describe("map", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page, { chargers });
    await fakeStatusApi(page, {});
  });

  const openCharger = async (page, name) => {
    await page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button", { name, exact: true })
      .click();
    return page.getByRole("complementary", { name });
  };

  test(
    "shows the charger's usual price and when it's cheaper or pricier",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page, { signedIn: true });
      const requests = await fakePricesApi(page);
      await page.goto("/");
      const details = await openCharger(page, "Rondo station");
      const prices = details.getByRole("region", { name: "Price history" });
      await expect(prices).toContainText("Usually 2.50 PLN/kWh over the last 30 days");
      await expect(prices).toContainText("Between 2.00 PLN/kWh and 3.00 PLN/kWh");
      await expect(prices).toContainText("Now 3.00 PLN/kWh, 20% pricier than usual");
      await expect(prices.getByRole("listitem").filter({ hasText: "Cheaper at" })).toHaveText(
        "Cheaper at 22:00–06:00"
      );
      await expect(prices).toContainText("Pricier at 17:00–19:00");
      await expect(prices).toContainText("Pricier on Sunday");
      const bars = prices.getByRole("list", { name: "Average price by hour of the day" });
      await expect(bars.getByRole("listitem")).toHaveCount(24);
      await expect(bars.getByRole("listitem").first()).toHaveText("00:00: 2.00 PLN/kWh");
      expect(requests).toEqual([["eipa:1"]]);
      await captureUi(page, testInfo, "the charger's price history");
    }
  );

  test("shows no price history for chargers without live prices", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    const requests = await fakePricesApi(page);
    await page.goto("/");
    const details = await openCharger(page, "Station without prices");
    await expect(details).toBeVisible();
    await expect(details.getByRole("region", { name: "Price history" })).toBeHidden();
    // Only sources with live prices are asked.
    expect(requests).toHaveLength(0);
  });

  test("asks nothing signed out", async ({ page }) => {
    await fakeAuthApi(page);
    const requests = await fakePricesApi(page);
    await page.goto("/");
    const details = await openCharger(page, "Rondo station");
    await expect(details).toBeVisible();
    await expect(details.getByRole("region", { name: "Price history" })).toBeHidden();
    expect(requests).toHaveLength(0);
  });
});
