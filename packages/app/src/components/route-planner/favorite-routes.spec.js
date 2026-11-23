import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// Two routes planned before, the latest first, one with a connector filter.
const TO_VIENNA = {
  origin: { label: "Budapest, Hungary", placeId: "budapest" },
  destination: { label: "Vienna, Austria", placeId: "vienna" },
  filters: { connectorTypes: ["ccs"] },
  plannedAt: 2,
};
const TO_BUDAPEST = {
  origin: { label: "Vienna, Austria", placeId: "vienna" },
  destination: { label: "Budapest, Hungary", placeId: "budapest" },
  filters: {},
  plannedAt: 1,
};
const history = { routeHistory: { routes: [TO_VIENNA, TO_BUDAPEST], updatedAt: 2 } };

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page, { signedIn: true });
  await fakeChargersApi(page);
  await fakeRouteChargersApi(page);
});

const openPlanner = async (page) => {
  await page.getByRole("button", { name: "Route", exact: true }).click();
  return page.getByRole("dialog", { name: "Plan a route" });
};

const routeNames = (region) =>
  region.locator(".recent-route .route-ends").evaluateAll((ends) => ends.map((e) => e.textContent));

test(
  "saves a route as a favorite, listed before the recent ones",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    const saves = await fakeSettingsApi(page, history);
    await page.goto("/");
    const dialog = await openPlanner(page);
    const favorites = dialog.getByRole("region", { name: "Favorite routes" });
    const recent = dialog.getByRole("region", { name: "Recent routes" });
    await expect(favorites).toBeHidden();
    expect(await routeNames(recent)).toEqual([
      "Budapest, Hungary → Vienna, Austria",
      "Vienna, Austria → Budapest, Hungary",
    ]);

    const save = recent.getByRole("button", {
      name: "Save Budapest, Hungary → Vienna, Austria as a favorite",
    });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await save.click();

    // It moves up into the favorites, with its filters, and keeps the focus.
    await expect(favorites).toBeVisible();
    expect(await routeNames(favorites)).toEqual(["Budapest, Hungary → Vienna, Austria"]);
    expect(await routeNames(recent)).toEqual(["Vienna, Austria → Budapest, Hungary"]);
    const remove = favorites.getByRole("button", {
      name: "Remove Budapest, Hungary → Vienna, Austria from favorites",
    });
    await expect(remove).toHaveAttribute("aria-pressed", "true");
    await expect(remove).toBeFocused();
    await expect(favorites.getByText("1 filter on")).toBeVisible();
    expect(saves.at(-1).favoriteRoutes.routes).toEqual([TO_VIENNA]);
    await captureUi(page, testInfo, "a favorite route, before the recent ones");

    // Kept in the account, after a reload too; choosing it plans it with
    // its filters.
    await page.reload();
    const again = await openPlanner(page);
    const saved = again.getByRole("region", { name: "Favorite routes" });
    await saved.getByRole("button", { name: /^Budapest, Hungary → Vienna, Austria/ }).click();
    await expect(page.getByRole("status")).toHaveText(
      "1 of 2 EV chargers along the route match the filters"
    );
  }
);

test("removes a favorite route, back among the recent ones", async ({ page }) => {
  const saves = await fakeSettingsApi(page, {
    ...history,
    favoriteRoutes: { routes: [TO_VIENNA], updatedAt: 3 },
  });
  await page.goto("/");
  const dialog = await openPlanner(page);
  const favorites = dialog.getByRole("region", { name: "Favorite routes" });
  await favorites
    .getByRole("button", { name: "Remove Budapest, Hungary → Vienna, Austria from favorites" })
    .click();

  await expect(favorites).toBeHidden();
  const recent = dialog.getByRole("region", { name: "Recent routes" });
  expect(await routeNames(recent)).toEqual([
    "Budapest, Hungary → Vienna, Austria",
    "Vienna, Austria → Budapest, Hungary",
  ]);
  await expect(
    recent.getByRole("button", { name: "Save Budapest, Hungary → Vienna, Austria as a favorite" })
  ).toBeFocused();
  expect(saves.at(-1).favoriteRoutes.routes).toEqual([]);
});
