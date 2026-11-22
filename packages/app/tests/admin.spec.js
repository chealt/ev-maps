import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };

// The Worker's answer to who is an admin (packages/worker/src/admin.js).
const fakeAdminApi = (page, admin) =>
  page.route("**/api/admin/me", (route) =>
    admin
      ? route.fulfill({ json: { admin: true, email: admin.email } })
      : route.fulfill({ status: 403, json: { error: "Only for admins." } })
  );

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
    await page.route("**/api/admin/dashboard", (route) =>
      route.fulfill({
        json: {
          days,
          errors: { "2026-11-23": 1, "2026-11-24": 2 },
          pageViews: { "2026-11-24": 1234 },
          signIns: {},
          topPages: [
            { path: "/hu/hu/", count: 40 },
            { path: "/en/", count: 10 },
          ],
        },
      })
    );

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
    await expect(pages.nth(1)).toHaveAttribute("style", "--share: 0.25;");
  }
);

test("says when the dashboard couldn't be loaded", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true, user: GRACE });
  await fakeAdminApi(page, GRACE);
  await page.route("**/api/admin/dashboard", (route) => route.fulfill({ status: 500 }));

  await page.goto("/en/admin/");

  await expect(page.getByRole("alert")).toHaveText("The dashboard couldn't be loaded. Try again.");
});
