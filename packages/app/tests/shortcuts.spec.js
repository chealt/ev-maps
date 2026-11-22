import { expect, test } from "./fixtures/test.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
  await page.goto("/");
});

const shortcuts = (page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

test("the ? key opens the keyboard shortcuts, Escape closes it", async ({ page }) => {
  await page.keyboard.press("?");

  const dialog = shortcuts(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Show this help")).toBeVisible();
  await expect(dialog.getByText("Close dialogs and the charger details")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("? belongs to an open dialog, not the shortcuts", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.keyboard.press("?");
  await expect(shortcuts(page)).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
});
