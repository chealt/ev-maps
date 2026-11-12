import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

test("shows the Google sign-in button for the configured client", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Account/ })).toBeHidden();
  const config = await page.evaluate(() => window.__gsi.config);
  expect(config.client_id).toBe("test-client-id");
});

test("signs in with Google and shows the account menu", async ({ page }) => {
  const signedIn = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener("google-sign-in", (event) => resolve(event.detail), {
          once: true,
        });
      })
  );

  await page.getByRole("button", { name: "Sign in with Google" }).click();

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeHidden();
  expect(await signedIn).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });

  const accountButton = page.getByRole("button", { name: "Account: Ada Lovelace" });
  await accountButton.click();

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Signed in as")).toBeVisible();
  await expect(menu.getByText("Ada Lovelace")).toBeVisible();
  await expect(menu.getByText("ada@example.com")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Account: Ada Lovelace", expanded: true })
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("signs out from the account menu", async ({ page }) => {
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();

  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("button", { name: "Sign out" })
    .click();

  await expect(page.getByRole("dialog", { name: "Account" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("ignores an invalid sign-in response", async ({ page }) => {
  await page.evaluate(() => window.__gsi.config.callback({ credential: "not-a-jwt" }));

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Account/ })).toBeHidden();
});
