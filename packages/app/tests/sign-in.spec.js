import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";

const signInButton = (page) => page.getByRole("button", { name: "Sign in with Google" });
const mapStatus = (page) => page.getByRole("status");

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
  await page.goto("/");
  await expect(mapStatus(page)).toHaveText("2 EV chargers found");
});

test("shows the Google sign-in button for the configured client", async ({ page }) => {
  await expect(signInButton(page)).toBeVisible();
  const config = await page.evaluate(() => window.__gsi.config);
  expect(config.client_id).toBe("test-client-id");
});

test("signs in with Google", async ({ page }) => {
  const signedIn = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener("google-sign-in", (event) => resolve(event.detail), {
          once: true,
        });
      })
  );

  await signInButton(page).click();

  await expect(mapStatus(page)).toHaveText("Signed in as Ada Lovelace");
  await expect(signInButton(page)).toBeHidden();
  expect(await signedIn).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
});

test("ignores an invalid sign-in response", async ({ page }) => {
  await page.evaluate(() => window.__gsi.config.callback({ credential: "not-a-jwt" }));

  await expect(mapStatus(page)).toHaveText("2 EV chargers found");
  await expect(signInButton(page)).toBeVisible();
});
