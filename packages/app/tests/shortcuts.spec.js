import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
  await page.goto("/");
});

const shortcuts = (page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

test(
  "the ? key opens the keyboard shortcuts, Escape closes it",
  { tag: "@ui" },
  async ({ page }) => {
    await page.keyboard.press("?");

    const dialog = shortcuts(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Show this help")).toBeVisible();
    await expect(dialog.getByText("Close dialogs and the charger details")).toBeVisible();
    for (const [key, label] of [
      ["f", "Show or hide the filters"],
      ["c", "Clear the filters"],
      ["l", "Locate me"],
      ["r", "Plan a route"],
    ]) {
      await expect(dialog.getByRole("listitem").filter({ hasText: label })).toContainText(key);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
);

test("f opens the filters, c clears them", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Filters" })
    .getByRole("button", { name: "150–300 kW" })
    .click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("status")).toHaveText("1 of 2 EV chargers match the filters");
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("1 filter on");

  await page.keyboard.press("f");
  const filters = page.getByRole("dialog", { name: "Filters" });
  await expect(filters).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filters).toBeHidden();

  await page.keyboard.press("c");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("");
});

test("l locates the user", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 47.4979, longitude: 19.0402 });
  await page.reload();
  await page.keyboard.press("l");
  await expect
    .poll(() => page.evaluate(() => window.__fakeMap.getCenter().toJSON()))
    .toEqual({ lat: 47.4979, lng: 19.0402 });
});

test("r opens the route planner", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await page.reload();
  await page.keyboard.press("r");
  await expect(page.getByRole("dialog", { name: "Plan a route" })).toBeVisible();
});

test("? belongs to an open dialog, not the shortcuts", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.keyboard.press("?");
  await expect(shortcuts(page)).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
});

test("the letter shortcuts belong to a field, not the map", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.keyboard.press("f");
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  // Focus lands on the dialog; typing f there must not close and reopen it.
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Done" }).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  await expect(page.getByRole("dialog", { name: "Plan a route" })).toBeHidden();
});
