import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// Home was saved before saved places kept their location, so the map looks
// it up by its place ID (the fake knows Budapest's).
const savedPlaces = {
  places: [
    { name: "Gym", icon: "star", label: "Gym Street 1", location: { lat: 47.51, lng: 19.03 } },
    { name: "Home", icon: "home", label: "Budapest, Hungary", placeId: "budapest" },
  ],
  updatedAt: 1,
};

test.describe("saved places", () => {
  test(
    "shows the saved places on the map unless turned off, and renames, re-icons and removes them on their page",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeGoogleMaps(page);
      await fakeAuthApi(page, { signedIn: true });
      await fakeChargersApi(page);
      const saves = await fakeSettingsApi(page, { savedPlaces });
      await page.goto("/");
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

      const map = page.getByRole("region", { name: "EV charging station map" });
      const gymPin = map.getByRole("button", { name: "Gym", exact: true });
      const homePin = map.getByRole("button", { name: "Home", exact: true });
      await expect(gymPin).toBeVisible();
      await expect(homePin).toBeVisible();
      await expect(gymPin.locator('[data-icon="star"]')).toBeVisible();
      await expect(homePin.locator('[data-icon="home"]')).toBeVisible();

      // Turned off in the account menu, in the account too; and on again.
      await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
      const menu = page.getByRole("dialog", { name: "Account" });
      const shown = menu.getByRole("switch", { name: "Show saved places" });
      await expect(shown).toBeChecked();
      await captureUi(page, testInfo, "account menu with saved places");
      await shown.uncheck();
      await expect(gymPin).toBeHidden();
      await expect(homePin).toBeHidden();
      expect(saves.at(-1).savedPlacesOnMap.shown).toBe(false);
      await shown.check();
      await expect(gymPin).toBeVisible();

      await menu.getByRole("link", { name: "My saved places" }).click();
      await expect(page).toHaveURL("/en/places/");
      await expect(page.getByRole("heading", { level: 1, name: "My saved places" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("2 saved places");
      await captureUi(page, testInfo, "saved places page");

      const gym = page.getByRole("article", { name: "Gym" });
      await gym.getByRole("textbox", { name: "Name" }).fill("Pool");
      await gym.getByRole("group", { name: "Icon" }).getByRole("button", { name: "Heart" }).click();
      await gym.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status")).toHaveText("Pool saved");
      await expect(page.getByRole("article", { name: "Pool" })).toBeVisible();
      expect(saves.at(-1).savedPlaces.places[0]).toEqual({
        ...savedPlaces.places[0],
        name: "Pool",
        icon: "heart",
      });

      await page
        .getByRole("article", { name: "Home" })
        .getByRole("button", { name: "Remove" })
        .click();
      await expect(page.getByRole("status")).toHaveText("Home removed");
      await expect(page.getByRole("article")).toHaveCount(1);
      expect(saves.at(-1).savedPlaces.places.map(({ name }) => name)).toEqual(["Pool"]);

      // Back on the map, as they are now.
      await page.getByRole("link", { name: "Back to the map" }).click();
      await expect(map.getByRole("button", { name: "Pool", exact: true })).toBeVisible();
      await expect(homePin).toBeHidden();
    }
  );

  test(
    "opens a saved place's menu from its pin: a route from or to it, or removing it",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeGoogleMaps(page);
      await fakeAuthApi(page, { signedIn: true });
      await fakeChargersApi(page);
      const saves = await fakeSettingsApi(page, { savedPlaces });
      await page.goto("/");
      await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

      const map = page.getByRole("region", { name: "EV charging station map" });
      const gymPin = map.getByRole("button", { name: "Gym", exact: true });
      const menu = page.getByRole("menu");
      // The fake map puts the pin outside the window: clicked where it is.
      await gymPin.dispatchEvent("click");
      await expect(menu).toContainText("Gym");
      await expect(menu.getByRole("menuitem", { name: "Route from here" })).toBeFocused();
      await expect(gymPin.locator(".saved-place-marker")).toHaveClass(/selected/);
      await captureUi(page, testInfo, "a saved place's menu");

      // From there: the planner opens with it filled in.
      await menu.getByRole("menuitem", { name: "Route from here" }).click();
      const dialog = page.getByRole("dialog", { name: "Plan a route" });
      await expect(dialog.getByRole("combobox", { name: "From" })).toHaveValue("Gym Street 1");
      await expect(gymPin.locator(".saved-place-marker")).not.toHaveClass(/selected/);
      await dialog.getByRole("button", { name: "Close" }).first().click();

      // The map's own menu has no place to remove.
      await page.locator(".google-map").click({ button: "right" });
      await expect(menu.getByRole("menuitem", { name: "Remove" })).toBeHidden();
      await page.keyboard.press("Escape");

      await gymPin.dispatchEvent("click");
      await menu.getByRole("menuitem", { name: "Remove" }).click();
      await expect(page.getByRole("status")).toHaveText("Gym removed");
      await expect(gymPin).toBeHidden();
      expect(saves.at(-1).savedPlaces.places.map(({ name }) => name)).toEqual(["Home"]);
    }
  );

  test("asks to sign in for the saved places page", async ({ page }) => {
    await page.route("**/api/settings", (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto("/en/places/");
    await expect(page.getByRole("status")).toHaveText("Sign in to see your saved places.");
  });
});
