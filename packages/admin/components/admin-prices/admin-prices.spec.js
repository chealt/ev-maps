import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { PRICES_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const HOUR = 60 * 60 * 1000;
const LAST_RUN = Date.UTC(2026, 10, 30, 11);

// As the Worker's history (packages/worker/src/charger-prices.js).
const history = {
  id: "eipa:1",
  unit: "PLN/kWh",
  timeZone: "Europe/Warsaw",
  from: LAST_RUN - 719 * HOUR,
  to: LAST_RUN,
  hours: [],
  changes: [
    { recordedAt: LAST_RUN - 48 * HOUR, price: 2 },
    { recordedAt: LAST_RUN - 2 * HOUR, price: 3 },
  ],
  usual: 2.5,
  min: 2,
  max: 3,
  current: 3,
  currentLevel: "higher",
  pricedHours: 720,
  byHour: Array.from({ length: 24 }, (_, hour) => (hour < 6 ? 2 : 2.5)),
  byWeekday: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3],
  cheapHours: [{ from: 0, to: 6 }],
  expensiveHours: [],
  cheapDays: [],
  expensiveDays: [6],
};

const pageData = (url) => {
  const chargerId = url.searchParams.get("charger");
  return {
    data: {
      tracked: 1234,
      changedToday: 56,
      runs: [{ source: "eipa", unit: "PLN/kWh", recordedAt: LAST_RUN }],
      recent: [
        {
          chargerId: "eipa:1",
          chargerName: "Rondo ONZ",
          unit: "PLN/kWh",
          recordedAt: LAST_RUN - 2 * HOUR,
          price: 3,
          previous: 2,
        },
      ],
      chargerId,
      charger: chargerId === "eipa:1" ? history : null,
    },
  };
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
  });

  test(
    "admin sees what prices are gathered and a charger's history",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakePageData(page, PRICES_PAGE, pageData);
      await page.goto("/en/admin/");
      await page.getByRole("link", { name: "Price history" }).click();

      await expect(page.getByRole("heading", { level: 2, name: "Price history" })).toBeVisible();
      await expect(page.getByText("1,234 chargers with a price, gathered hourly")).toBeVisible();
      await expect(page.getByText("Changes in the last day")).toBeVisible();
      const recent = page.getByRole("region", { name: "Latest changes" });
      await expect(recent.getByRole("row", { name: /Rondo ONZ/ })).toContainText("2.00 PLN/kWh");

      await recent.getByRole("link", { name: "Rondo ONZ" }).click();
      await expect(page).toHaveURL(/\?charger=eipa%3A1$/);
      const charger = page.getByRole("region", { name: "eipa:1, last 30 days" });
      await expect(charger.getByText("2.50 PLN/kWh")).toBeVisible();
      const byHour = charger.getByRole("table", { name: "Average by hour of the day" });
      await expect(byHour.getByRole("row")).toHaveCount(25);
      await expect(byHour.getByRole("row", { name: /00:00/ })).toHaveAttribute(
        "data-level",
        "lower"
      );
      const byDay = charger.getByRole("table", { name: "Average by day of the week" });
      await expect(byDay.getByRole("row", { name: /Sunday/ })).toHaveAttribute(
        "data-level",
        "higher"
      );
      await expect(charger.getByRole("table", { name: "Changes" }).getByRole("row")).toHaveCount(3);
      await captureUi(page, testInfo, "admin viewing a charger's price history");
    }
  );

  test("finds a charger by its ID, and says when it has no history", async ({ page }) => {
    await fakePageData(page, PRICES_PAGE, pageData);
    await page.goto("/en/admin/prices/");
    await page.getByRole("textbox", { name: "Charger ID" }).fill("ocm:9");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByText("No price history for ocm:9.")).toBeVisible();
  });

  test("says when the prices couldn't be loaded", async ({ page }) => {
    await fakePageData(page, PRICES_PAGE, { failed: true });
    await page.goto("/en/admin/prices/");
    await expect(page.getByText("The price history couldn't be loaded. Try again.")).toBeVisible();
  });
});
