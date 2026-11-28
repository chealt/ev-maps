import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { supportLinks } from "../../lib/support-links.js";

test.describe("account", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page);
  });

  // Every provider takes the same path through the page (the Worker starts
  // the provider's flow): one is signed in with end to end in English, another
  // on a sub-page in another language; the rest are only offered.
  test(
    "signs in with Google and stays signed in after a reload",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      const signInRequests = await fakeAuthApi(page, {
        providers: ["google", "github", "microsoft", "apple"],
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Sign in" }).click();
      const menu = page.getByRole("dialog", { name: "Account" });
      for (const provider of ["GitHub", "Microsoft", "Apple"]) {
        await expect(menu.getByRole("button", { name: `Sign in with ${provider}` })).toBeVisible();
      }

      await menu.getByRole("button", { name: "Sign in with Google" }).click();

      const accountButton = page.getByRole("button", {
        name: "Account: Ada Lovelace",
      });
      await expect(accountButton).toBeVisible();
      expect(signInRequests).toEqual([
        {
          provider: "google",
          callbackURL: "/en/",
          errorCallbackURL: "/en/?sign-in-error=",
        },
      ]);

      await page.reload();
      await accountButton.click();
      await expect(menu.getByText("Signed in as")).toBeVisible();
      await expect(menu.getByText("Ada Lovelace")).toBeVisible();
      await expect(menu.getByText("ada@example.com")).toBeVisible();
      await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeHidden();
      // The account domain's own picture of the open menu (#378).
      await captureUi(page, testInfo, "account menu signed in");
    }
  );

  test("signs in with another provider, coming back to the same page", async ({ page }) => {
    const signInRequests = await fakeAuthApi(page, {
      providers: ["google", "microsoft"],
    });
    await page.goto("/pl/hu/");
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    await page.getByRole("button", { name: "Zaloguj się przez Microsoft" }).click();

    await expect(page.getByRole("button", { name: "Konto: Ada Lovelace" })).toBeVisible();
    await expect(page).toHaveURL("/pl/hu/");
    expect(signInRequests[0]).toMatchObject({
      provider: "microsoft",
      callbackURL: "/pl/hu/",
    });
  });

  test("offers signing in with the providers the Worker has, the theme and the language", async ({
    page,
  }) => {
    await fakeAuthApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(menu.getByRole("radio", { name: "System" })).toBeChecked();
    await expect(menu.getByRole("combobox", { name: "Language" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Sign in", expanded: true })).toBeVisible();

    // None the Worker can sign in with, or none known: no sign-in buttons, the
    // rest of the menu as usual.
    for (const providers of [
      (route) => route.fulfill({ json: { providers: [] } }),
      (route) => route.fulfill({ status: 502 }),
    ]) {
      await page.route("**/api/sign-in-providers", providers);
      await page.reload();
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(menu.getByRole("radio", { name: "System" })).toBeVisible();
      await expect(menu.getByRole("button", { name: /^Sign in with/ })).toHaveCount(0);
      await page.unroute("**/api/sign-in-providers");
    }
  });

  // Follows the enabled platforms in src/lib/support-links.js, so turning one
  // on doesn't break it.
  test(
    "links to supporting EV Maps, the language's own option first",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page);
      await page.goto("/");
      await page.getByRole("button", { name: "Sign in" }).click();
      const menu = page.getByRole("dialog", { name: "Account" });
      const support = menu.getByRole("region", { name: "Support EV Maps" });
      const enabled = supportLinks("en");
      if (enabled.length === 0) {
        await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
        await expect(support).toHaveCount(0);
        return;
      }
      const links = support.getByRole("link");
      await expect(links).toHaveText(
        enabled.map(({ name }) => new RegExp(`^${name.replace(/[.]/g, "\\.")}`))
      );
      await expect(links.first()).toHaveAccessibleName(`${enabled[0].name} (opens in a new tab)`);
      await expect(links.first()).toHaveAttribute("target", "_blank");
      await expect(links.first()).toHaveAttribute("href", enabled[0].url);

      // A click counts the platform, and nothing else, with a beacon.
      const clickRequest = page.waitForRequest("**/api/support-clicks");
      await page.route("**/api/support-clicks", (route) => route.fulfill({ status: 204 }));
      await page.context().route(enabled[0].url, (route) => route.fulfill({ body: "" }));
      const [, request] = await Promise.all([
        page.context().waitForEvent("page"),
        clickRequest,
        links.first().click(),
      ]);
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ platform: enabled[0].id });
      for (const other of page.context().pages().slice(1)) {
        await other.close();
      }
      await support.scrollIntoViewIfNeeded();
      await captureUi(page, testInfo, "account menu support links");

      await page.goto("/pl/");
      await page.getByRole("button", { name: "Zaloguj się" }).click();
      await expect(
        page.getByRole("region", { name: "Wesprzyj EV Maps" }).getByRole("link").first()
      ).toHaveAttribute("href", supportLinks("pl")[0].url);
    }
  );

  test("shows the account loading until the session is known, and Sign in when it can't be", async ({
    page,
  }) => {
    await fakeAuthApi(page, { signedIn: true });
    let releaseSession;
    const sessionHeld = new Promise((resolve) => {
      releaseSession = resolve;
    });
    await page.route("**/api/auth/get-session", async (route) => {
      await sessionHeld;
      await route.fallback();
    });
    await page.goto("/");
    const loading = page.getByRole("button", { name: "Loading your account" });
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading.getByText("Sign in", { exact: true })).toBeHidden();
    releaseSession();
    const account = page.getByRole("button", { name: "Account: Ada Lovelace" });
    await expect(account).toBeVisible();
    await expect(account).not.toHaveAttribute("aria-busy");

    // The session can't be loaded (the network, or the Worker): signed out,
    // the map working as usual.
    for (const fail of [(route) => route.abort(), (route) => route.fulfill({ status: 500 })]) {
      await page.unroute("**/api/auth/get-session");
      await page.route("**/api/auth/get-session", fail);
      await page.reload();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Loading your account" })).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    }
  });

  test("says when sign-in can't start, or failed at the provider", async ({ page }) => {
    await fakeAuthApi(page, { signInStatus: 500 });
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await expect(page.getByRole("alert")).toHaveText("Sign-in failed. Please try again.");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

    // Back from the provider with an error: said in the open menu, and the
    // error dropped from the address.
    await page.goto("/en/?sign-in-error=");
    const menu = page.getByRole("dialog", { name: "Account" });
    await expect(menu.getByRole("alert")).toHaveText("Sign-in failed. Please try again.");
    await expect(page).toHaveURL("/en/");
  });

  test("signs out", { tag: "@regression" }, async ({ page }) => {
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

  // On a phone the menu spans the screen, less the margin on both sides (#424).
  test("opens full width on narrow screens", { tag: "@ui" }, async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const margin = 390 - (box.x + box.width);
    expect(margin).toBeGreaterThan(0);
    expect(Math.round(box.x)).toBe(Math.round(margin));
    await captureUi(page, testInfo, "account menu narrow screen");
  });

  // On desktop the menu fits the three maps apps in one row of segments,
  // even with Hungarian's, the longest names (#378).
  test("fits the maps apps in one row on desktop, in every language", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/hu/");
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    const apps = page.getByRole("group", { name: "Térképalkalmazás" }).locator("label");
    await expect(apps).toHaveCount(3);
    const tops = await apps.evaluateAll((labels) =>
      labels.map((label) => Math.round(label.getBoundingClientRect().top))
    );
    expect(new Set(tops).size).toBe(1);
  });
});
