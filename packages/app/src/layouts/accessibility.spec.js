import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

// Every test is checked with axe as it ends (fixtures/test.js); these also
// check the main screens on the way, in the light and the dark theme.
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const expectAccessible = async (page, screen) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(
    violations.map(
      ({ id, nodes }) => `${screen}: ${id} ${nodes.map((node) => node.target).join(", ")}`
    )
  ).toEqual([]);
};

for (const colorScheme of ["light", "dark"]) {
  test.describe(`in the ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("the map, a charger, the filters and the account menu", async ({ page }) => {
      await fakeGoogleMaps(page);
      await fakeAuthApi(page, { signedIn: true });
      await fakeChargersApi(page);
      await page.goto("/en/");
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
      await expectAccessible(page, "map");

      await page
        .getByRole("region", { name: "EV charging station map" })
        .getByRole("button", { name: "Downtown Supercharger" })
        .click();
      await expect(
        page.getByRole("complementary", { name: "Downtown Supercharger" })
      ).toBeVisible();
      await expectAccessible(page, "charger details");

      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      await expectAccessible(page, "filters");
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
      await expect(page.getByRole("dialog", { name: "Account" })).toBeVisible();
      await expectAccessible(page, "account menu");
    });

    test("a legal page and the admin pages", async ({ page }) => {
      await fakeAuthApi(page, { signedIn: true });
      await page.route("**/api/admin/me", (route) =>
        route.fulfill({ json: { admin: true, email: "grace@chealt.com" } })
      );
      await page.route("**/api/admin/errors?**", (route) =>
        route.fulfill({
          json: {
            groups: [
              {
                fingerprint: "00000000",
                source: "page",
                name: "TypeError",
                message: "Cannot read the charger",
                url: "/en/",
                context: null,
                count: 2,
                users: 1,
                first_seen: Date.now() - 3600000,
                last_seen: Date.now(),
              },
            ],
            page: 1,
            pages: 1,
            total: 1,
          },
        })
      );
      await page.goto("/en/privacy/");
      await expectAccessible(page, "privacy policy");

      for (const path of ["/en/admin/", "/en/admin/errors/"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expectAccessible(page, path);
      }
    });
  });
}
