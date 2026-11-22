import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator, fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

const ALL_METHODS = ["google", "passkey", "email"];

const openMenu = async (page, name = "Sign in", menuName = "Account") => {
  await page.getByRole("button", { name }).click();
  return page.getByRole("dialog", { name: menuName });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
});

test("emails a sign-in link that returns to this page", async ({ page }) => {
  const requests = await fakeAuthApi(page, { providers: ALL_METHODS });
  await page.goto("/hu/hu/");
  const menu = await openMenu(page, "Bejelentkezés", "Fiók");

  await menu.getByLabel("E-mail-cím").fill("ada@example.com");
  await menu.getByRole("button", { name: "Küldj bejelentkezési linket" }).click();

  await expect(menu.getByRole("status")).toHaveText(
    "Bejelentkezési linket küldtünk a(z) ada@example.com címre. 15 percen belül nyisd meg."
  );
  expect(requests).toEqual([
    {
      magicLink: {
        email: "ada@example.com",
        callbackURL: "/hu/hu/",
        errorCallbackURL: "/hu/hu/?sign-in-error=",
      },
    },
  ]);
});

test("says when too many sign-in emails were asked for", async ({ page }) => {
  await fakeAuthApi(page, { providers: ALL_METHODS, magicLinkStatus: 429 });
  await page.goto("/");
  const menu = await openMenu(page);

  await menu.getByLabel("Email address").fill("ada@example.com");
  await menu.getByRole("button", { name: "Email me a sign-in link" }).click();

  await expect(menu.getByRole("alert")).toHaveText(
    "Too many sign-in emails. Try again in a minute."
  );
});

test("asks for an email address before sending a link", async ({ page }) => {
  const requests = await fakeAuthApi(page, { providers: ALL_METHODS });
  await page.goto("/");
  const menu = await openMenu(page);

  await menu.getByRole("button", { name: "Email me a sign-in link" }).click();

  await expect(menu.getByLabel("Email address")).toBeFocused();
  expect(requests).toHaveLength(0);
});

test("offers no passkey or email where the Worker doesn't", async ({ page }) => {
  await fakeAuthApi(page, { providers: ["google"] });
  await page.goto("/");
  const menu = await openMenu(page);

  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign in with a passkey" })).toBeHidden();
  await expect(menu.getByLabel("Email address")).toBeHidden();
});

test("adds a passkey once signed in, and then signs in with it", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const requests = await fakeAuthApi(page, { signedIn: true, providers: ALL_METHODS });
  await page.goto("/");
  let menu = await openMenu(page, "Account: Ada Lovelace");

  await menu.getByRole("button", { name: "Add a passkey" }).click();

  await expect(menu.getByRole("status")).toHaveText("Passkey added. Next time, sign in with it.");
  await expect(menu.getByRole("button", { name: "Add a passkey" })).toBeHidden();
  const registration = requests.find((request) => request.passkeyRegistration);
  expect(registration.passkeyRegistration.response.type).toBe("public-key");

  await menu.getByRole("button", { name: "Sign out" }).click();
  menu = await openMenu(page);
  await menu.getByRole("button", { name: "Sign in with a passkey" }).click();

  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const authentication = requests.find((request) => request.passkeyAuthentication);
  expect(authentication.passkeyAuthentication.response.type).toBe("public-key");
});

test("doesn't offer a passkey to an account that has one", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true, providers: ALL_METHODS, passkeys: [{ id: "p" }] });
  await page.goto("/");
  const menu = await openMenu(page, "Account: Ada Lovelace");

  await expect(menu.getByText("Ada Lovelace", { exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Add a passkey" })).toBeHidden();
});

test("says when signing in with a passkey fails, but not when cancelled", async ({ page }) => {
  await fakeAuthApi(page, { providers: ALL_METHODS });
  await page.route("**/api/auth/passkey/generate-authenticate-options", (route) =>
    route.fulfill({ status: 500, json: {} })
  );
  await page.goto("/");
  const menu = await openMenu(page);

  await menu.getByRole("button", { name: "Sign in with a passkey" }).click();

  await expect(menu.getByRole("alert")).toHaveText(
    "Signing in with a passkey didn't work. Try again, or use your email."
  );
});
