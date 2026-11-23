import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "#fixtures/auth-api.js";
import { fakeChargersApi } from "#fixtures/chargers-api.js";
import { fakeGoogleMaps } from "#fixtures/google.js";

const openMenu = async (page) => {
  await page.getByRole("button", { name: "Sign in" }).click();
  return page.getByRole("dialog", { name: "Account" });
};

const animationsAttribute = (page) =>
  page.evaluate(() => document.documentElement.dataset.animations ?? null);

// Every other test runs with reduced motion (playwright.config.js).
test.use({ reducedMotion: "no-preference" });

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
});

test("animates by default, and remembers turning it off", { tag: "@ui" }, async ({ page }) => {
  await page.goto("/");
  const menu = await openMenu(page);
  const animations = menu.getByRole("checkbox", { name: "Animations" });
  await expect(animations).toBeChecked();
  await expect(animations).toBeEnabled();
  expect(await animationsAttribute(page)).toBeNull();

  await animations.uncheck();
  expect(await animationsAttribute(page)).toBe("off");

  // Applied before the first paint on the next visit, too.
  await page.reload();
  expect(await animationsAttribute(page)).toBe("off");
  await expect(
    (await openMenu(page)).getByRole("checkbox", { name: "Animations" })
  ).not.toBeChecked();
});

test("is off while the system asks for reduced motion, and says so", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const menu = await openMenu(page);

  const animations = menu.getByRole("checkbox", { name: "Animations" });
  await expect(animations).not.toBeChecked();
  await expect(animations).toBeDisabled();
  await expect(animations).toHaveAccessibleDescription("Off: your system asks for reduced motion.");

  // The user's own choice comes back once the system stops asking.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(animations).toBeChecked();
  await expect(animations).toBeEnabled();
});

test(
  "the dialogs still open and close, with Escape too, while animating",
  { tag: "@ui" },
  async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
    const filters = page.getByRole("dialog", { name: "Filters" });

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(filters).toBeVisible();
    await filters.getByRole("button", { name: "Done" }).click();
    await expect(filters).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters", expanded: false })).toBeVisible();

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(filters).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    await expect(details).toBeVisible();
    await details.getByRole("button", { name: "Close" }).click();
    await expect(details).toBeHidden();
  }
);
