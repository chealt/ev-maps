import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { PREFERENCES_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };

// The Worker's preference stats: the pages are rendered on the server with
// them (in the tests, passed in a header: src/lib/page-data.js).
const STATS = {
  accounts: 4,
  pageViewDays: 30,
  groups: {
    signIn: {
      unit: "users",
      rows: [
        { value: "google", count: 3 },
        { value: "passkey", count: 1 },
      ],
    },
    language: {
      unit: "pageViews",
      rows: [
        { value: "hu", count: 30 },
        { value: "en", count: 10 },
      ],
    },
    theme: { unit: "pageViews", rows: [{ value: "dark", count: 40 }] },
    carConnectors: { unit: "users", rows: [{ value: "ccs", count: 2 }] },
    filterPowerRanges: { unit: "users", rows: [{ value: "150-300", count: 1 }] },
    popularRoutes: { unit: "users", rows: [] },
  },
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
  });

  test(
    "shows what users prefer, a section per page",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakePageData(page, PREFERENCES_PAGE, { data: STATS });
      await page.goto("/en/admin/usage/");

      const subnav = page.getByRole("navigation", { name: "Usage pages" });
      await expect(subnav.getByRole("link", { name: "Activity" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await subnav.getByRole("link", { name: "Settings" }).click();

      await expect(page).toHaveURL("/en/admin/usage/settings/");
      await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
      await expect(page.getByText("4 accounts")).toBeVisible();
      const signIn = page.getByRole("region", { name: "Sign-in method" });
      await expect(signIn).toContainText("Accounts, now");
      await expect(signIn.getByRole("row").first()).toHaveText(/Google\s*3 \(75%\)/);
      // Shares of the page views, the languages by name.
      const language = page.getByRole("region", { name: "Language" });
      await expect(language).toContainText("Page views, last 30 days");
      await expect(language.getByRole("row").first()).toHaveText(/Hungarian\s*30 \(75%\)/);
      await expect(
        page.getByRole("region", { name: "Car's connectors" }).getByRole("row")
      ).toHaveText([/CCS\s*2 \(50%\)/]);
      await expect(page.getByRole("region", { name: "Maps app" })).toContainText("Nothing yet.");
      await expect(subnav.getByRole("link", { name: "Settings" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await captureUi(page, testInfo, "admin usage settings preferences");

      await subnav.getByRole("link", { name: "Filters" }).click();
      await expect(
        page.getByRole("region", { name: "Charging power" }).getByRole("row")
      ).toHaveText([/150–300 kW\s*1 \(25%\)/]);

      await subnav.getByRole("link", { name: "Routes and places" }).click();
      await expect(page.getByRole("region", { name: "Popular routes" })).toContainText(
        "Nothing yet."
      );
    }
  );

  test("says when the preferences couldn't be loaded", async ({ page }) => {
    await fakePageData(page, PREFERENCES_PAGE, { failed: true });
    await page.goto("/en/admin/usage/filters/");

    await expect(page.getByText("The preferences couldn't be loaded. Try again.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Charging power" })).toHaveCount(0);
  });
});
