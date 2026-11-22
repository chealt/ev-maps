import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeFavoritesApi } from "./fixtures/favorites-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

// Far enough apart that they aren't clustered at the default zoom; the map
// starts at New York.
const charger = (id, name, [lat, lng]) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: `${name} street`,
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
});

const near = charger(1, "Near charger", [40.73, -73.99]);
const far = charger(2, "Far charger", [40.79, -74.02]);
const budapest = charger(3, "Budapest charger", [47.4979, 19.0402]);

const map = (page) => page.getByRole("region", { name: "EV charging station map" });
const details = (page, name) => page.getByRole("complementary", { name });
const openCharger = async (page, name) => {
  await map(page).getByRole("button", { name }).click();
  return details(page, name);
};
const openFavorites = async (page) => {
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("button", { name: "Favorites" })
    .click();
  return page.getByRole("dialog", { name: "Favorites" });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers: [near, far] });
});

test("saves a charger as a favorite with the heart, and removes it", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const changes = await fakeFavoritesApi(page);
  await page.goto("/");
  const panel = await openCharger(page, "Near charger");
  const heart = panel.getByRole("button", { name: "Favorite" });
  await expect(heart).toHaveAttribute("aria-pressed", "false");

  await heart.click();

  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]).toMatchObject({ method: "PUT", id: "ocm:1", body: { charger: near } });

  await page.reload();
  const reloaded = await openCharger(page, "Near charger");
  await expect(reloaded.getByRole("button", { name: "Favorite" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await reloaded.getByRole("button", { name: "Favorite" }).click();
  await expect(reloaded.getByRole("button", { name: "Favorite" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect.poll(() => changes.length).toBe(2);
  expect(changes[1]).toMatchObject({ method: "DELETE", id: "ocm:1" });
});

test("undoes the heart when saving fails", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeFavoritesApi(page, [], { failChanges: true });
  await page.goto("/");
  const panel = await openCharger(page, "Near charger");
  const heart = panel.getByRole("button", { name: "Favorite" });

  await heart.click();

  await expect(heart).toHaveAttribute("aria-pressed", "false");
});

test("shows the heart signed out, asking to sign in", async ({ page }) => {
  await fakeAuthApi(page);
  const changes = await fakeFavoritesApi(page);
  await page.goto("/");
  const panel = await openCharger(page, "Near charger");
  const heart = panel.getByRole("button", { name: "Favorite" });

  await expect(heart).toHaveAttribute("aria-disabled", "true");
  await expect(heart).toHaveAccessibleDescription("Sign in to save chargers as favorites.");
  await heart.hover();
  await expect(panel.getByRole("tooltip")).toBeVisible();

  await heart.click({ force: true });

  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Favorites" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  expect(changes).toHaveLength(0);
});

test("lists the favorites nearest to the map's center first", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeFavoritesApi(page, [
    { charger: budapest, addedAt: 3 },
    { charger: far, addedAt: 2 },
    { charger: near, addedAt: 1 },
  ]);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  const dialog = await openFavorites(page);

  await expect(dialog.getByText("Nearest to the map's center first")).toBeVisible();
  await expect(dialog.locator(".name")).toHaveText([
    "Near charger",
    "Far charger",
    "Budapest charger",
  ]);
  await expect(dialog.locator(".distance").last()).toHaveText(/km$/);
});

test("shows a favorite on the map from the list, wherever it is", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeFavoritesApi(page, [{ charger: budapest, addedAt: 1 }]);
  // Budapest's tiles have it too, as the real ones would.
  await fakeChargersApi(page, { chargers: [near, far, budapest] });
  await page.goto("/");
  const dialog = await openFavorites(page);

  await dialog.locator(".entry", { hasText: "Budapest charger" }).click();

  await expect(dialog).toBeHidden();
  await expect(details(page, "Budapest charger")).toBeVisible();
  const center = await page.evaluate(() => window.__fakeMap.getCenter().toJSON());
  expect(center.lat).toBeCloseTo(47.4979, 0);
});

test("removes a favorite from the list", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const changes = await fakeFavoritesApi(page, [{ charger: near, addedAt: 1 }]);
  await page.goto("/");
  const dialog = await openFavorites(page);

  await dialog.getByRole("button", { name: "Remove Near charger from favorites" }).click();

  await expect(dialog.getByText("No favorites yet.", { exact: false })).toBeVisible();
  await expect.poll(() => changes.length).toBe(1);
  await expect(dialog.getByRole("button", { name: "Close favorites" })).toBeFocused();
});

test("shows only the favorites with the filter", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeFavoritesApi(page, [{ charger: far, addedAt: 1 }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });

  await filters.getByRole("button", { name: "Only favorites" }).click();

  await expect(page.getByRole("status")).toHaveText("1 of 2 EV chargers match the filters");
  await filters.getByRole("button", { name: "Done" }).click();
  await expect(map(page).getByRole("button", { name: "Far charger" })).toBeVisible();
  await expect(map(page).getByRole("button", { name: "Near charger" })).toBeHidden();
});

test("asks to sign in for the favorites filter when signed out", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  const toggle = filters.getByRole("button", { name: "Only favorites" });

  await expect(toggle).toHaveAttribute("aria-disabled", "true");
  await expect(toggle).toHaveAccessibleDescription("Sign in to save chargers as favorites.");
  await toggle.click({ force: true });

  await expect(filters).toBeHidden();
  await expect(
    page
      .getByRole("dialog", { name: "Account" })
      .getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
});

test.describe("with the service worker", () => {
  // Every other test blocks service workers (see playwright.config.js).
  test.use({ serviceWorkers: "allow" });

  const loadControlledPage = async (page) => {
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  };

  // The Worker can't be reached for favorites, as when offline.
  const unreachable = (route) => route.abort();
  const goOffline = (page) => page.context().route(/\/api\/favorites/, unreachable);
  const goOnline = (page) => page.context().unroute(/\/api\/favorites/, unreachable);

  test("keeps a favorite saved offline, and sends it once online", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    const changes = await fakeFavoritesApi(page);
    await loadControlledPage(page);
    await goOffline(page);

    const panel = await openCharger(page, "Near charger");
    await panel.getByRole("button", { name: "Favorite" }).click();
    await expect(panel.getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Still offline after a reload: the service worker has it.
    await page.reload();
    const reloaded = await openCharger(page, "Near charger");
    await expect(reloaded.getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(changes).toHaveLength(0);

    await goOnline(page);
    await page.reload();

    await expect.poll(() => changes.length).toBe(1);
    expect(changes[0]).toMatchObject({ method: "PUT", id: "ocm:1", body: { charger: near } });
    const dialog = await openFavorites(page);
    await expect(dialog.locator(".name")).toHaveText(["Near charger"]);
  });

  test("forgets the stored favorites on signing out", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    await fakeFavoritesApi(page, [{ charger: near, addedAt: 1 }]);
    await loadControlledPage(page);
    const dialog = await openFavorites(page);
    await expect(dialog.locator(".name")).toHaveText(["Near charger"]);
    await dialog.getByRole("button", { name: "Close favorites" }).click();

    await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              const request = indexedDB.open("ev-maps-sw", 1);
              request.onsuccess = () => {
                const read = request.result
                  .transaction("state")
                  .objectStore("state")
                  .get("favorites");
                read.onsuccess = () => resolve(read.result ?? null);
              };
            })
        )
      )
      .toBeNull();
  });
});
