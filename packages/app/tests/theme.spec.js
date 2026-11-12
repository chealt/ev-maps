import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";

const mapState = (page) =>
  page.evaluate(() => ({
    colorScheme: window.__fakeMap.options.colorScheme,
    center: window.__fakeMap.center,
    zoom: window.__fakeMap.zoom,
  }));

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
});

test("follows the system theme by default", async ({ page }) => {
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "System" })).toBeChecked();
  expect((await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");
});

test("switches the map to the dark theme and keeps its position", async ({ page }) => {
  const before = await mapState(page);

  await page.getByRole("dialog", { name: "Account" }).getByRole("radio", { name: "Dark" }).check();

  await expect.poll(() => mapState(page)).toEqual({ ...before, colorScheme: "DARK" });
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button")).toHaveCount(2);
});

test("remembers the chosen theme", async ({ page }) => {
  await page.getByRole("dialog", { name: "Account" }).getByRole("radio", { name: "Light" }).check();

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect((await mapState(page)).colorScheme).toBe("LIGHT");

  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await expect(
    page.getByRole("dialog", { name: "Account" }).getByRole("radio", { name: "Light" })
  ).toBeChecked();
});

test("goes back to following the system theme", async ({ page }) => {
  const menu = page.getByRole("dialog", { name: "Account" });
  await menu.getByRole("radio", { name: "Dark" }).check();
  await menu.getByRole("radio", { name: "System" }).check();

  await expect.poll(async () => (await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect((await mapState(page)).colorScheme).toBe("FOLLOW_SYSTEM");
});
