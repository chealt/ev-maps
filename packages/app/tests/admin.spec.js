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
