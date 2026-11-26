import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
  await page.goto("/");
});

const shortcuts = (page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

test(
  "the ? key opens the keyboard shortcuts, Escape closes it",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
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
      ["x", "Clear the route"],
    ]) {
      await expect(dialog.getByRole("listitem").filter({ hasText: label })).toContainText(key);
    }
    await captureUi(page, testInfo, "the keyboard shortcuts");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
);

test("the letter shortcuts: f the filters, c clears them, l locates, r plans a route, x clears it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 47.4979, longitude: 19.0402 });
  await fakeAuthApi(page, { signedIn: true });
  await fakeRouteChargersApi(page);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  // f opens the filters (Escape closes them); c clears them.
  await page.keyboard.press("f");
  const filters = page.getByRole("dialog", { name: "Filters" });
  await filters.getByRole("button", { name: "150–300 kW" }).click();
  await page.keyboard.press("Escape");
  await expect(filters).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("1 of 2 EV chargers match the filters");
  await page.keyboard.press("c");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  // l locates the user.
  await page.keyboard.press("l");
  await expect
    .poll(() => page.evaluate(() => window.__fakeMap.getCenter().toJSON()))
    .toEqual({ lat: 47.4979, lng: 19.0402 });

  // x does nothing without a route; r opens the planner, and x clears the
  // route planned.
  await page.keyboard.press("x");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await page.keyboard.press("r");
  const planner = page.getByRole("dialog", { name: "Plan a route" });
  for (const [field, text, option] of [
    ["From", "Buda", "Budapest, Hungary"],
    ["To", "Vie", "Vienna, Austria"],
  ]) {
    await planner.getByRole("combobox", { name: field }).fill(text);
    await planner.getByRole("option", { name: option }).click();
  }
  await planner.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  await expect(page.getByRole("button", { name: "Clear route" })).toHaveAttribute(
    "aria-keyshortcuts",
    "x"
  );
  await page.keyboard.press("x");
  await expect(page.getByRole("button", { name: "Clear route" })).toBeHidden();
  await expect(page.evaluate(() => window.__fakeRouteLine)).resolves.toBeNull();
});

test("the keys belong to an open dialog, or a field, not the map", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });

  // ? in a dialog: not the shortcuts.
  await page.keyboard.press("?");
  await expect(shortcuts(page)).toBeHidden();
  await expect(filters).toBeVisible();

  // f in the dialog doesn't close and reopen it; l doesn't locate.
  await page.keyboard.press("f");
  await expect(filters).toBeVisible();
  await filters.getByRole("button", { name: "Done" }).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  await expect(page.getByRole("dialog", { name: "Plan a route" })).toBeHidden();
});
