import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeFavoritesApi } from "@ev-maps/e2e/fixtures/favorites-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

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

// Which cluster a favorite marks is unit tested (ChargerIndex.clusterHas in
// charger-index.test.js); the pins' and clusters' colors are in the UI
// evidence.
test(
  "saves a charger as a favorite with the heart, marks its pin, removes it, and undoes the heart when saving fails",
  { tag: "@regression" },
  async ({ page }) => {
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

    // Kept after a reload, its pin named as a favorite.
    await page.reload();
    await expect(map(page).getByRole("button", { name: "Near charger, favorite" })).toBeVisible();
    const reloaded = await openCharger(page, "Near charger");
    const reloadedHeart = reloaded.getByRole("button", { name: "Favorite" });
    await expect(reloadedHeart).toHaveAttribute("aria-pressed", "true");

    await reloadedHeart.click();
    await expect(reloadedHeart).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => changes.length).toBe(2);
    expect(changes[1]).toMatchObject({ method: "DELETE", id: "ocm:1" });
    await expect(
      map(page).getByRole("button", { name: "Near charger", exact: true })
    ).toBeVisible();

    // The account can't take it: the heart goes back.
    await page.route(/\/api\/favorites/, (route) =>
      route.request().method() === "GET" ? route.fallback() : route.fulfill({ status: 500 })
    );
    await reloadedHeart.click();
    await expect(reloadedHeart).toHaveAttribute("aria-pressed", "false");
  }
);

test("asks to sign in for the heart, reporting a change and the favorites filter when signed out", async ({
  page,
}) => {
  await fakeAuthApi(page);
  const changes = await fakeFavoritesApi(page);
  await page.goto("/");
  const panel = await openCharger(page, "Near charger");
  const heart = panel.getByRole("button", { name: "Favorite" });
  await expect(heart).toHaveAttribute("aria-disabled", "true");
  await expect(heart).toHaveAccessibleDescription("Sign in to save chargers as favorites.");
  await heart.hover();
  await expect(panel.getByRole("tooltip")).toBeVisible();

  // Reporting a change to the charger asks to sign in too.
  const report = panel.getByRole("button", { name: "Report a change" });
  await expect(report).toHaveAttribute("aria-disabled", "true");
  await expect(report).toHaveAccessibleDescription("Sign in to report a change to this charger.");
  await report.click({ force: true });
  await expect(
    page
      .getByRole("dialog", { name: "Account" })
      .getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Report a change" })).toBeHidden();
  // Escape closes the menu and the charger's details.
  await page.keyboard.press("Escape");
  await openCharger(page, "Near charger");

  await heart.click({ force: true });
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Favorites" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  const toggle = filters.getByRole("button", { name: "Only favorites" });
  await expect(toggle).toHaveAttribute("aria-disabled", "true");
  await expect(toggle).toHaveAccessibleDescription("Sign in to save chargers as favorites.");
  await toggle.click({ force: true });
  await expect(filters).toBeHidden();
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  expect(changes).toHaveLength(0);
});

test(
  "lists the favorites nearest first, shows one on the map from the list, and removes one",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true });
    const changes = await fakeFavoritesApi(page, [
      { charger: budapest, addedAt: 3 },
      { charger: far, addedAt: 2 },
      { charger: near, addedAt: 1 },
    ]);
    // Budapest's tiles have it too, as the real ones would.
    await fakeChargersApi(page, { chargers: [near, far, budapest] });
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText(/EV chargers found/);

    let dialog = await openFavorites(page);
    await expect(dialog.getByText("Nearest to the map's center first")).toBeVisible();
    await expect(dialog.locator(".name")).toHaveText([
      "Near charger",
      "Far charger",
      "Budapest charger",
    ]);
    await expect(dialog.locator(".distance").last()).toHaveText(/km$/);
    await captureUi(page, testInfo, "the favorites, nearest first, with their distances");

    await dialog.getByRole("button", { name: "Remove Near charger from favorites" }).click();
    await expect(dialog.locator(".name")).toHaveText(["Far charger", "Budapest charger"]);
    await expect.poll(() => changes.length).toBe(1);

    // Wherever it is, the map goes there, once the charger index (a Web
    // Worker) says how close.
    await dialog.locator(".entry", { hasText: "Budapest charger" }).click();
    await expect(dialog).toBeHidden();
    await expect(details(page, "Budapest charger")).toBeVisible();
    await expect
      .poll(async () => (await page.evaluate(() => window.__fakeMap.getCenter().toJSON())).lat)
      .toBeCloseTo(47.4979, 0);

    // The last ones removed: the list says there are none.
    dialog = await openFavorites(page);
    for (const name of ["Far charger", "Budapest charger"]) {
      await dialog.getByRole("button", { name: `Remove ${name} from favorites` }).click();
    }
    await expect(dialog.getByText("No favorites yet.", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close favorites" })).toBeFocused();
  }
);

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
