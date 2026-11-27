import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { ERRORS_PAGE, OVERVIEW_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };

// The Worker's answer to who is an admin (packages/admin/src/admin.js).
const fakeAdminApi = (page, admin) =>
  page.route("**/api/admin/me", (route) =>
    admin
      ? route.fulfill({ json: { admin: true, email: admin.email } })
      : route.fulfill({ status: 403, json: { error: "Only for admins." } })
  );

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page);
  });

  test("links admins to the admin area from the account menu", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await fakeAdminApi(page, GRACE);
    await page.goto("/");
    await page.getByRole("button", { name: "Account: Grace Hopper" }).click();
    const menu = page.getByRole("dialog", { name: "Account" });

    await menu.getByRole("link", { name: "Admin" }).click();

    await expect(page).toHaveURL("/en/admin/");
    await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Signed in as grace@chealt.com");
    await expect(page).toHaveTitle("EV Maps - Admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow, noai, noimageai"
    );
  });

  test("doesn't link other users to the admin area", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    await fakeAdminApi(page, null);
    await page.goto("/");
    await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
    const menu = page.getByRole("dialog", { name: "Account" });

    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Admin" })).toBeHidden();
  });

  test("doesn't link anyone signed out to the admin area", async ({ page }) => {
    const requests = [];
    await fakeAuthApi(page);
    await page.route("**/api/admin/me", (route) => {
      requests.push(route.request().url());
      return route.fulfill({ status: 401, json: {} });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("dialog", { name: "Account" }).getByRole("link", { name: "Admin" })
    ).toBeHidden();
    expect(requests).toHaveLength(0);
  });

  test("signs admins out and back to the map", { tag: "@ui" }, async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await fakeAdminApi(page, GRACE);
    await page.goto("/en/admin/");
    await expect(page.getByRole("status")).toHaveText("Signed in as grace@chealt.com");
    const signOut = page.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeVisible();
    await captureUi(page, testInfo, "admin sign out");

    await signOut.click();

    await expect(page).toHaveURL("/en/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("asks to sign in as an admin when the API refuses", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    await fakeAdminApi(page, null);

    await page.goto("/en/admin/");

    await expect(page.getByText("Sign in with an admin account to see this page.")).toBeVisible();
  });

  test(
    "shows admins errors, page views and sign-ins per day on the overview",
    { tag: "@performance" },
    async ({ page }) => {
      await fakeAuthApi(page, { signedIn: true, user: GRACE });
      await fakeAdminApi(page, GRACE);
      const days = Array.from({ length: 30 }, (_, index) =>
        new Date(Date.UTC(2026, 9, 26 + index)).toISOString().slice(0, 10)
      );
      // Rendered on the server with the dashboard (in the tests, passed in a
      // header: src/lib/page-data.js).
      await fakePageData(page, OVERVIEW_PAGE, {
        data: {
          days,
          errors: { "2026-11-23": 1, "2026-11-24": 2 },
          pageViews: { "2026-11-24": 1234 },
          signIns: {},
          topPages: [
            { path: "/hu/hu/", count: 40 },
            { path: "/en/", count: 10 },
          ],
        },
      });

      await page.goto("/en/admin/");

      const dashboard = page.getByRole("region", { name: "Last 30 days" });
      const errors = dashboard.getByRole("article").filter({ hasText: "Errors per day" });
      await expect(errors.getByRole("listitem")).toHaveCount(30);
      await expect(errors.getByRole("listitem").last()).toHaveText("Nov 24: 2");
      await expect(errors.getByText("3 in total")).toBeVisible();
      await expect(errors.getByRole("link", { name: "All errors" })).toHaveAttribute(
        "href",
        "/en/admin/errors/"
      );
      const pageViews = dashboard.getByRole("article").filter({ hasText: "Page views per day" });
      await expect(pageViews.getByText("1,234 in total")).toBeVisible();
      const signIns = dashboard.getByRole("article").filter({ hasText: "Sign-ins per day" });
      await expect(signIns.getByText("0 in total")).toBeVisible();
      await expect(signIns.getByRole("link", { name: "All usage stats" })).toHaveAttribute(
        "href",
        "/en/admin/usage/"
      );

      const topPages = dashboard.getByRole("article", {
        name: "Most visited pages, the last 30 days",
      });
      const pages = topPages.getByRole("listitem");
      await expect(pages).toHaveCount(2);
      await expect(pages.first()).toContainText("/hu/hu/");
      await expect(pages.first()).toContainText("40");
      await expect(pages.first().getByRole("link", { name: "/hu/hu/" })).toHaveAttribute(
        "href",
        "/hu/hu/"
      );
      // Each bar is as long as its share of the most visited page's.
      await expect(pages.nth(1)).toHaveAttribute("style", "--share: 0.25");
    }
  );

  test("says when the dashboard couldn't be loaded", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await fakeAdminApi(page, GRACE);
    await fakePageData(page, OVERVIEW_PAGE, { failed: true });

    await page.goto("/en/admin/");

    await expect(page.getByRole("alert")).toHaveText(
      "The dashboard couldn't be loaded. Try again."
    );
  });

  test(
    "navigates by groups of sections, collapsed to the icons and kept so",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page, { signedIn: true, user: GRACE });
      await fakeAdminApi(page, GRACE);
      await fakePageData(page, OVERVIEW_PAGE, { failed: true });
      await fakePageData(page, ERRORS_PAGE, {
        data: { groups: [], total: 0, page: 1, pages: 1 },
      });
      await page.goto("/en/admin/errors/");

      const nav = page.getByRole("navigation", { name: "Admin" });
      const engineering = nav.getByRole("region", { name: "Engineering" });
      await expect(engineering.getByRole("link", { name: "Errors" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await expect(engineering.getByRole("link", { name: "Test reports" })).toBeVisible();
      await expect(nav.getByRole("region", { name: "Community" })).toContainText(
        "Suggested chargers"
      );
      await expect(page.locator(".breadcrumb")).toHaveText(/Engineering\s*Errors/);
      await expect(page.getByRole("status")).toHaveText("Signed in as grace@chealt.com");
      await captureUi(page, testInfo, "admin navigation");

      // Collapsed, just the icons: the links keep their names.
      const collapse = page.getByRole("button", { name: "Collapse the navigation" });
      await collapse.click();
      await expect(collapse).toHaveAttribute("aria-pressed", "true");
      await expect(nav.getByText("Test reports")).not.toBeInViewport();
      await captureUi(page, testInfo, "admin navigation collapsed");

      // And still on the next page.
      await nav.getByRole("link", { name: "Overview" }).click();
      await expect(page).toHaveURL("/en/admin/");
      await expect(collapse).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-admin-nav", "collapsed");
      await collapse.click();
      await expect(page.locator("html")).not.toHaveAttribute("data-admin-nav", "collapsed");
    }
  );
});
