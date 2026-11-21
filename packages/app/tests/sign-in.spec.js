import { expect, test } from "@playwright/test";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
});

test("offers sign-in, the theme and the language when signed out", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in" }).click();

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(menu.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(menu.getByRole("navigation", { name: "Language" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign in", expanded: true })).toBeVisible();
});

test("offers only the providers the Worker can sign in with", async ({ page }) => {
  await fakeAuthApi(page, { providers: [] });
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in" }).click();

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "System" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeHidden();
});

test("offers no sign-in when the providers can't be loaded", async ({ page }) => {
  await fakeAuthApi(page);
  await page.route("**/api/sign-in-providers", (route) => route.fulfill({ status: 502 }));
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in" }).click();

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "System" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeHidden();
  await expect(menu.getByRole("button", { name: "Sign in with GitHub" })).toBeHidden();
});

test("signs in with GitHub", async ({ page }) => {
  const signInRequests = await fakeAuthApi(page, { providers: ["google", "github"] });
  await page.goto("/hu/");
  await page.getByRole("button", { name: "Bejelentkezés" }).click();

  await page.getByRole("button", { name: "Bejelentkezés GitHub-fiókkal" }).click();

  await expect(page.getByRole("button", { name: "Fiók: Ada Lovelace" })).toBeVisible();
  expect(signInRequests[0].provider).toBe("github");
});

test("signs in with Microsoft", async ({ page }) => {
  const signInRequests = await fakeAuthApi(page, { providers: ["google", "microsoft"] });
  await page.goto("/pl/");
  await page.getByRole("button", { name: "Zaloguj się" }).click();

  await page.getByRole("button", { name: "Zaloguj się przez Microsoft" }).click();

  await expect(page.getByRole("button", { name: "Konto: Ada Lovelace" })).toBeVisible();
  expect(signInRequests[0].provider).toBe("microsoft");
});

test("signs in with Google and stays signed in after a reload", async ({ page }) => {
  const signInRequests = await fakeAuthApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("button", { name: "Sign in with Google" }).click();

  const accountButton = page.getByRole("button", { name: "Account: Ada Lovelace" });
  await expect(accountButton).toBeVisible();
  expect(signInRequests).toEqual([
    { provider: "google", callbackURL: "/en/", errorCallbackURL: "/en/?sign-in-error=" },
  ]);

  await page.reload();
  await accountButton.click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByText("Signed in as")).toBeVisible();
  await expect(menu.getByText("Ada Lovelace")).toBeVisible();
  await expect(menu.getByText("ada@example.com")).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeHidden();
});

test("comes back to the same page after signing in", async ({ page }) => {
  const signInRequests = await fakeAuthApi(page);
  await page.goto("/pl/hu/");
  await page.getByRole("button", { name: "Zaloguj się" }).click();

  await page.getByRole("button", { name: "Zaloguj się przez Google" }).click();

  await expect(page.getByRole("button", { name: "Konto: Ada Lovelace" })).toBeVisible();
  await expect(page).toHaveURL("/pl/hu/");
  expect(signInRequests[0].callbackURL).toBe("/pl/hu/");
});

test("says when sign-in can't start", async ({ page }) => {
  await fakeAuthApi(page, { signInStatus: 500 });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("button", { name: "Sign in with Google" }).click();

  await expect(page.getByRole("alert")).toHaveText("Sign-in failed. Please try again.");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("says when sign-in failed at the provider", async ({ page }) => {
  await fakeAuthApi(page);

  await page.goto("/en/?sign-in-error=");

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("alert")).toHaveText("Sign-in failed. Please try again.");
  await expect(page).toHaveURL("/en/");
});

test("signs out", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();

  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("button", { name: "Sign out" })
    .click();

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Account" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("stays signed out when the session can't be loaded", async ({ page }) => {
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ status: 500 }));
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});
