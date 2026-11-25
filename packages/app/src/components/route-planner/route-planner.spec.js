import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeRouteChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// The fake route API places chargers along any route; these add a café to
// the first only.
const chargersWithPlaces = [
  {
    id: "ocm:1",
    source: "ocm",
    name: "Café charger",
    location: { lat: 47.5, lng: 19.05 },
    address: "",
    maxPowerKw: 50,
    connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
    amenities: ["coffee"],
  },
  {
    id: "ocm:2",
    source: "ocm",
    name: "Bare charger",
    location: { lat: 47.51, lng: 19.06 },
    address: "",
    maxPowerKw: 50,
    connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
  },
];

// Planning routes needs a signed-in user, so these tests sign in.
// The fake place search knows Budapest, Vienna and Nowhere Island (which no
// route reaches), and drives in a straight line. The fake route API puts the
// two fixture chargers 50 and 100 km along any route.

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page, { signedIn: true });
  await fakeChargersApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
});

const choosePlace = async (dialog, field, text, option) => {
  await dialog.getByRole("combobox", { name: field }).fill(text);
  await dialog.getByRole("option", { name: option }).click();
};

test(
  "zooms back out to the whole route, from the top bar, clear of the header and footer",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });
    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await dialog.getByRole("button", { name: "Show route" }).click();

    await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

    // Panning away (e.g. to look at a charger) is undone by the button.
    await page.evaluate(() => window.__fakeMap.panBy(300, 300));
    const panned = await page.evaluate(() => ({ ...window.__fakeMap.center }));

    const zoom = page.getByRole("button", { name: "Zoom to route" });
    await captureUi(page, testInfo, "Zoom to route, next to Locate Me");

    await zoom.click();
    const after = await page.evaluate(() => ({
      bounds: window.__fakeMap.fittedBounds,
      center: window.__fakeMap.center,
      padding: window.__fakeMap.fittedPadding,
    }));
    // The fit leaves extra room at the top and bottom, for the top bar and the
    // map controls over the map, so they don't cover the route.
    expect(after.padding.top).toBeGreaterThan(after.padding.left);
    expect(after.padding.bottom).toBeGreaterThan(after.padding.left);
    expect(after.center).not.toEqual(panned);
    expect(after.bounds).toMatchObject({
      north: expect.any(Number),
      south: expect.any(Number),
      east: expect.any(Number),
      west: expect.any(Number),
    });
    // The fit centers the route's bounds, not where the map was panned.
    expect(after.center).toEqual({
      lat: (after.bounds.north + after.bounds.south) / 2,
      lng: (after.bounds.east + after.bounds.west) / 2,
    });
  }
);

test(
  "shows the route and filter buttons with their clear halves",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });
    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await dialog.getByRole("button", { name: "Show route" }).click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("button", { name: "CCS" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByRole("button", { name: "Clear route" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await captureUi(page, testInfo, "the route and filter buttons with their clear halves");
  }
);

test(
  "shows the chargers along a route",
  { tag: ["@regression", "@ui"] },
  async ({ page }, testInfo) => {
    const routeRequests = await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });

    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await captureUi(page, testInfo, "the route planner, filled in");
    await dialog.getByRole("button", { name: "Show route" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
    await expect(page.getByRole("button", { name: "Clear route" })).toBeVisible();
    await captureUi(page, testInfo, "the route on the map");
    const map = page.getByRole("region", { name: "EV charging station map" });
    await expect(map.getByRole("button", { name: "Downtown Supercharger" })).toBeVisible();
    // What the app asked Google and the Worker for.
    const [routeRequest] = await page.evaluate(() => window.__routeRequests);
    expect(routeRequest).toMatchObject({
      origin: { id: "budapest" },
      destination: { id: "vienna" },
      travelMode: "DRIVING",
    });
    expect(routeRequests[0].corridorKm).toBe(5);
    expect(routeRequests[0].path[0]).toEqual([47.4979, 19.0402]);
    expect(routeRequests[0].path.at(-1)).toEqual([48.2082, 16.3738]);
    expect(await page.evaluate(() => window.__fakeRouteLine.path.length)).toBe(21);
  }
);

test("lists the chargers in order along the route", { tag: "@ui" }, async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();

  await page.getByRole("button", { name: "2 EV chargers along the route" }).click();

  const list = page.getByRole("dialog", { name: "2 EV chargers" });
  await expect(list.getByText("Sorted by: distance from start")).toBeVisible();
  const entries = list.getByRole("listitem");
  await expect(entries.nth(0)).toContainText("Downtown Supercharger");
  // Each charger shows where it sits along the route as a small graph,
  // labelled with the distances from the start, to the end and off it.
  const first = entries.nth(0).getByRole("img");
  await expect(first).toHaveAccessibleName(
    "50 km from the start, 100 km to the end, 1 km off the route"
  );
  const second = entries.nth(1).getByRole("img");
  await expect(second).toHaveAccessibleName(
    "100 km from the start, 50 km to the end, 1 km off the route"
  );
  // Halfway along the route, and a quarter in, with a bend in the road
  // carrying the +X km detour and the start/end distances under the nodes.
  const bendProgress = (entry) =>
    entry.evaluate((el) => el.style.getPropertyValue("--route-progress"));
  expect(await bendProgress(first)).toBe("33.33333333333333%");
  expect(await bendProgress(second)).toBe("66.66666666666666%");
  await expect(first.locator(".route-visual-bend .route-visual-detour")).toHaveText("+1 km");
  await expect(first.locator(".route-visual-distance.start")).toHaveText("50 km");
  await expect(first.locator(".route-visual-distance.end")).toHaveText("100 km");
});

test("filters the chargers along the route by power", async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  await filters.getByRole("button", { name: "150–300 kW" }).click();
  await filters.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
});

test("filters the chargers along the route by the places next to them", async ({ page }) => {
  await fakeRouteChargersApi(page, { chargers: chargersWithPlaces });
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  await filters.getByRole("button", { name: "Café" }).click();
  await filters.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "Café charger" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Bare charger" })).toBeHidden();
});

test("clears the route and goes back to the map's chargers", async ({ page }) => {
  await fakeRouteChargersApi(page, { chargers: [] });
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("No EV chargers along the route");

  await page.getByRole("button", { name: "Clear route" }).click();

  await expect(page.getByRole("button", { name: "Clear route" })).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  expect(await page.evaluate(() => window.__fakeRouteLine)).toBeNull();
});

test("starts from the user's location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 47.4979, longitude: 19.0402 });
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });

  await dialog.getByRole("button", { name: "Use my location" }).click();
  await expect(dialog.getByRole("combobox", { name: "From" })).toHaveValue("My location");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  const [routeRequest] = await page.evaluate(() => window.__routeRequests);
  expect(routeRequest.origin).toEqual({ lat: 47.4979, lng: 19.0402 });
});

test("chooses a suggestion with the keyboard", async ({ page }) => {
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  const from = dialog.getByRole("combobox", { name: "From" });

  await from.fill("Buda");
  await expect(dialog.getByRole("option", { name: "Budapest, Hungary" })).toBeVisible();
  await from.press("ArrowDown");
  await expect(
    dialog.getByRole("option", { name: "Budapest, Hungary", selected: true })
  ).toBeVisible();
  await from.press("Enter");

  await expect(from).toHaveValue("Budapest, Hungary");
  await expect(dialog.getByRole("listbox")).toBeHidden();
});

test("asks to choose both places from the suggestions", async ({ page }) => {
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await dialog.getByRole("combobox", { name: "From" }).fill("Somewhere I typed");

  await dialog.getByRole("button", { name: "Show route" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Choose both places from the suggestions");
  await expect(dialog).toBeVisible();
});

test("says when there's no route", async ({ page }) => {
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Nowhere", "Nowhere Island, Ocean");

  await dialog.getByRole("button", { name: "Show route" }).click();

  await expect(page.getByRole("status")).toHaveText("No route found between these places");
});

test("plans the route in the page's language", async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.goto("/pl/");
  await page.getByRole("button", { name: "Trasa" }).click();
  const dialog = page.getByRole("dialog", { name: "Zaplanuj trasę" });

  await choosePlace(dialog, "Skąd", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "Dokąd", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Pokaż trasę" }).click();

  await expect(page.getByRole("status")).toHaveText("2 stacje ładowania na trasie");
  const [placeRequest] = await page.evaluate(() => window.__placeRequests);
  expect(placeRequest.language).toBe("pl");
  const [routeRequest] = await page.evaluate(() => window.__routeRequests);
  expect(routeRequest.language).toBe("pl");
});

test("asks to sign in before planning a route", async ({ page }) => {
  await fakeAuthApi(page);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await page.getByRole("button", { name: "Route" }).click();

  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await expect(
    dialog.getByText("Sign in to plan routes and see the chargers along them.")
  ).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "From" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Show route" })).toBeDisabled();

  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(dialog).toBeHidden();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("keeps the route after a reload, until it's cleared", async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  await expect(page.getByRole("button", { name: "Clear route" })).toBeVisible();
  expect(await page.evaluate(() => window.__fakeRouteLine.path.length)).toBe(21);
  // Just planned, it's shown as saved: not planned again.
  expect(await page.evaluate(() => window.__routeRequests)).toHaveLength(0);
  // The same places in the route planner.
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "From" })).toHaveValue("Budapest, Hungary");
  await expect(dialog.getByRole("combobox", { name: "To" })).toHaveValue("Vienna, Austria");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Clear route" }).click();
  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await expect(page.getByRole("button", { name: "Clear route" })).toBeHidden();
});

test("shows a route planned a while ago at once after a reload, and plans it again in the background", async ({
  page,
}) => {
  await page.clock.install();
  await page.reload();
  const routeRequests = await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

  // Two hours later, the chargers along it have changed.
  await page.clock.fastForward("02:00:00");
  await fakeRouteChargersApi(page, { chargers: [] });
  await page.reload();

  // Shown from what was saved first…
  await expect(page.getByRole("button", { name: "Clear route" })).toBeVisible();
  // …then planned again with the same places, and the new plan shown.
  await expect
    .poll(() => page.evaluate(() => window.__routeRequests))
    .toEqual([
      expect.objectContaining({ origin: { id: "budapest" }, destination: { id: "vienna" } }),
    ]);
  await expect(page.getByRole("status")).toHaveText("No EV chargers along the route");
  expect(routeRequests).toHaveLength(1);
});

test("keeps the routes planned, with their filters, to plan again", async ({ page }) => {
  const saves = await fakeSettingsApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await expect(dialog.getByRole("region", { name: "Recent routes" })).toBeHidden();
  await dialog.getByRole("button", { name: "Close route planner" }).click();
  await expect(dialog).toBeHidden();

  // Planned with a connector filter on.
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "CCS" }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
  await expect.poll(() => saves.length).toBeGreaterThanOrEqual(1);
  expect(saves.at(-1).routeHistory.routes).toHaveLength(1);
  expect(saves.at(-1).routeHistory.routes[0]).toMatchObject({
    origin: { label: "Budapest, Hungary", placeId: "budapest" },
    destination: { label: "Vienna, Austria", placeId: "vienna" },
    filters: { connectorTypes: ["ccs"] },
  });

  // Clearing the route and planning another leaves the history at both,
  // the latest first.
  await page.getByRole("button", { name: "Clear route" }).click();
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
  // The same route planned again moves up, with the filters of this time.
  expect(saves.at(-1).routeHistory.routes).toHaveLength(1);

  // After clearing, the history plans it again with its filters.
  await page.getByRole("button", { name: "Clear route" }).click();
  await page.getByRole("button", { name: "Route", exact: true }).click();
  const recent = dialog.getByRole("region", { name: "Recent routes" });
  await expect(
    recent.getByRole("button", { name: /^Budapest, Hungary → Vienna, Austria/ })
  ).toHaveText(/.*1 filter on.*/);
  await recent.getByRole("button", { name: /^Budapest, Hungary → Vienna, Austria/ }).click();

  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("1 filter on");
});

test("draws the route over a casing, in the theme's colors", async ({ page }) => {
  // The route's line and the casing under it (--color-route and
  // --color-route-casing).
  const LIGHT = { line: "rgb(126, 34, 206)", casing: "rgb(255, 255, 255)" };
  const DARK = { line: "rgb(216, 180, 254)", casing: "rgb(15, 23, 42)" };
  const routeColors = () =>
    page.evaluate(() => {
      const [casing, line] = window.__fakeRouteLines ?? [];
      if (!line) {
        return null;
      }
      return {
        line: line.strokeColor,
        casing: casing.strokeColor,
        wider: casing.strokeWeight > line.strokeWeight,
      };
    });

  await page.emulateMedia({ colorScheme: "light" });
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect.poll(routeColors).toEqual({ ...LIGHT, wider: true });

  // Following the system theme, the route follows the system's.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(routeColors).toEqual({ ...DARK, wider: true });

  // Choosing a theme, the route takes its colors, on the new map.
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("radio", { name: "Light" }).check();
  await expect.poll(routeColors).toEqual({ ...LIGHT, wider: true });
  expect(await page.evaluate(() => window.__fakeRouteLines.length)).toBe(2);
});

test("plans with the distance from the route chosen, and keeps it with the route", async ({
  page,
}) => {
  const saves = await fakeSettingsApi(page);
  const routeRequests = await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  const distances = dialog.getByRole("group", { name: "Distance from the route" });
  await expect(distances.getByRole("radio", { name: "5 km" })).toBeChecked();
  await expect(dialog.getByText("Chargers within 5 km of the route are shown.")).toBeVisible();

  await distances.getByRole("radio", { name: "2 km" }).check();
  await expect(dialog.getByText("Chargers within 2 km of the route are shown.")).toBeVisible();
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  expect(routeRequests.at(-1).corridorKm).toBe(2);
  await expect.poll(() => saves.at(-1)?.routeHistory?.routes[0]?.corridorKm).toBe(2);

  // After a reload, the route is shown again with it, and the planner says so.
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  expect(routeRequests.at(-1).corridorKm).toBe(2);
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await expect(distances.getByRole("radio", { name: "2 km" })).toBeChecked();
  await expect(
    dialog.getByRole("region", { name: "Recent routes" }).getByText("1 filter on")
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("region", { name: "Recent routes" }).getByText("no filters · within 2 km")
  ).toBeVisible();
});

test(
  "shows a route's charger's distances in its details",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    const map = page.getByRole("region", { name: "EV charging station map" });
    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    // Without a route, a charger has none.
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    await expect(details).toBeVisible();
    await expect(details.getByText("off the route")).toBeHidden();
    await details.getByRole("button", { name: "Close" }).click();

    await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });
    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await dialog.getByRole("button", { name: "Show route" }).click();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

    // The same charger's pin, kept from the map's load, opens the route's
    // copy of it, with where it is along the route as a small graph.
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    await expect(details.getByRole("img")).toHaveAccessibleName(
      "50 km from the start, 100 km to the end, 1 km off the route"
    );
    await captureUi(page, testInfo, "a route's charger's details");
  }
);

test("sorts the chargers along the route by distance from the start, the end or off it", async ({
  page,
}) => {
  await fakeRouteChargersApi(page, { chargers: chargersWithPlaces });
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await page.getByRole("button", { name: "2 EV chargers along the route" }).click();

  const list = page.getByRole("dialog", { name: "2 EV chargers" });
  const names = () =>
    list.locator(".recent-route, .item .name").evaluateAll((els) => els.map((e) => e.textContent));
  const sortBy = (label) => list.getByRole("radio", { name: label }).check();

  await expect(list.getByText("Sorted by: distance from start")).toBeVisible();
  expect(await names()).toEqual(["Café charger", "Bare charger"]);

  await sortBy("Distance to end");
  await expect(list.getByText("Sorted by: distance to end")).toBeVisible();
  expect(await names()).toEqual(["Bare charger", "Café charger"]);

  await sortBy("Distance off the route");
  await expect(list.getByText("Sorted by: distance off the route")).toBeVisible();

  // Not along a route: no sorting to choose.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear route" }).click();
  await page.getByRole("button", { name: "2 EV chargers found" }).click();
  await expect(page.getByRole("dialog", { name: "2 EV chargers" }).getByRole("radio")).toHaveCount(
    0
  );
});

test("shares the route as a link that plans it again", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const routeRequests = await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

  // No Web Share in the test browser: the link goes to the clipboard. The
  // share button is in the planner's footer, so it opens first.
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await dialog.getByRole("button", { name: "Share route" }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("from=Budapest");
  expect(url).toContain("to=Vienna");
  expect(url).toContain("corridorKm=5");

  // Opening the shared link plans the same route.
  await page.goto(url);
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  expect(routeRequests.at(-1).corridorKm).toBe(5);
});

test(
  "adds a charger as a stop along a route and removes it",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });
    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await dialog.getByRole("button", { name: "Show route" }).click();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

    // Open a charger on the map and add it as a stop: the route re-plans
    // through it right away.
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    const addStop = details.getByRole("button", { name: "Add stop" });
    await expect(addStop).toHaveAttribute("aria-pressed", "false");
    await captureUi(page, testInfo, "charger details with Add stop");
    await addStop.click();

    await expect(details).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__routeRequests.length)).toBe(2);
    const requestWithStop = await page.evaluate(() => window.__routeRequests.at(-1));
    expect(requestWithStop).toMatchObject({
      origin: { id: "budapest" },
      destination: { id: "vienna" },
      intermediates: [{ lat: 47.7465, lng: 18.10696 }],
    });
    expect(await page.evaluate(() => window.__fakeRouteLine.path.length)).toBe(41);

    // Re-opening the charger shows it's already a stop; the planner lists it
    // between From and To, and shows it in the recent routes.
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    await expect(details.getByRole("button", { name: "Remove stop", pressed: true })).toBeVisible();
    await details.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Route", exact: true }).click();
    const stops = dialog.getByRole("group", { name: "Stops" });
    await expect(stops).toBeVisible();
    await expect(stops.getByText("Downtown Supercharger")).toBeVisible();
    // The planned route's legs are shown between the points they join: into
    // the stop, and from it into To.
    await expect(stops.getByText(/from the previous point/)).toHaveCount(2);
    await expect(
      dialog.getByRole("region", { name: "Recent routes" }).getByRole("button", {
        name: /^Budapest, Hungary → Downtown Supercharger → Vienna, Austria/,
      })
    ).toBeVisible();
    await captureUi(page, testInfo, "route planner with a stop");

    // Removing the stop in the planner and showing the route plans without it.
    await stops.getByRole("button", { name: "Remove Downtown Supercharger from stops" }).click();
    await expect(stops).toBeHidden();
    await dialog.getByRole("button", { name: "Show route" }).click();
    await expect.poll(() => page.evaluate(() => window.__routeRequests.length)).toBe(3);
    expect(await page.evaluate(() => window.__routeRequests.at(-1).intermediates)).toBeUndefined();
  }
);

test("adding a charger as a stop before planning opens the route planner with it", async ({
  page,
}) => {
  await fakeRouteChargersApi(page);
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: "Downtown Supercharger" }).click();
  const details = page.getByRole("complementary", { name: "Downtown Supercharger" });

  await details.getByRole("button", { name: "Add stop" }).click();

  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await expect(dialog).toBeVisible();
  const stops = dialog.getByRole("group", { name: "Stops" });
  await expect(stops.getByText("Downtown Supercharger")).toBeVisible();

  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
  const [routeRequest] = await page.evaluate(() => window.__routeRequests);
  expect(routeRequest.intermediates).toEqual([{ lat: 40.71, lng: -74 }]);
});

test("clears the From and To inputs with their clear buttons", async ({ page }) => {
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  const from = dialog.getByRole("combobox", { name: "From" });
  const to = dialog.getByRole("combobox", { name: "To" });
  const clearFrom = dialog.getByRole("button", { name: "Clear place: From" });
  const clearTo = dialog.getByRole("button", { name: "Clear place: To" });

  await expect(clearFrom).toBeHidden();
  await expect(clearTo).toBeHidden();

  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await expect(clearFrom).toBeVisible();
  await expect(clearTo).toBeVisible();

  await clearFrom.click();
  await expect(from).toHaveValue("");
  await expect(clearFrom).toBeHidden();

  await clearTo.click();
  await expect(to).toHaveValue("");
  await expect(clearTo).toBeHidden();
});

test(
  "saves places with presets or a custom label and icon, and chooses them for the route",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    const saves = await fakeSettingsApi(page);
    await fakeRouteChargersApi(page);
    await page.getByRole("button", { name: "Route" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a route" });

    // Choose From and save it as Home using the preset.
    await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
    await dialog.getByRole("button", { name: "Save place: From" }).click();
    const savePanel = dialog.getByRole("group", { name: "Save place" });
    await expect(savePanel).toBeVisible();
    const presetsGroup = savePanel.getByRole("group", { name: "Place presets" });
    const iconGroup = savePanel.getByRole("group", { name: "Icon" });
    await presetsGroup.getByRole("button", { name: "Home" }).click();
    await expect(savePanel.getByLabel("Label")).toHaveValue("Home");
    await expect(iconGroup.getByRole("button", { name: "Home", pressed: true })).toBeVisible();
    await savePanel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(savePanel).toBeHidden();

    // Choose To and save it with a custom label and Star icon.
    await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
    await dialog.getByRole("button", { name: "Save place: To" }).click();
    await savePanel.getByLabel("Label").fill("Opera");
    await iconGroup.getByRole("button", { name: "Star" }).click();
    await expect(iconGroup.getByRole("button", { name: "Star", pressed: true })).toBeVisible();
    await savePanel.getByRole("button", { name: "Save", exact: true }).scrollIntoViewIfNeeded();
    await captureUi(page, testInfo, "saving a place with a custom label and icon");
    await savePanel.getByRole("button", { name: "Save", exact: true }).click();

    await expect.poll(() => saves.at(-1)?.savedPlaces?.places.length).toBe(2);
    expect(saves.at(-1).savedPlaces.places).toEqual([
      { name: "Opera", icon: "star", label: "Vienna, Austria", placeId: "vienna" },
      { name: "Home", icon: "home", label: "Budapest, Hungary", placeId: "budapest" },
    ]);

    // Clear both fields and pick the saved places from the chips.
    await dialog.getByRole("button", { name: "Clear place: From" }).click();
    await dialog.getByRole("button", { name: "Clear place: To" }).click();
    const fromSaved = dialog.getByRole("group", { name: "Saved places: From" });
    const toSaved = dialog.getByRole("group", { name: "Saved places: To" });
    await fromSaved.getByRole("button", { name: "Home", exact: true }).click();
    await toSaved.getByRole("button", { name: "Opera", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: "From" })).toHaveValue("Budapest, Hungary");
    await expect(dialog.getByRole("combobox", { name: "To" })).toHaveValue("Vienna, Austria");
    await captureUi(page, testInfo, "route planner with saved places");

    await dialog.getByRole("button", { name: "Show route" }).click();
    await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");

    // Removing a saved place removes it from the chips and the account.
    await page.getByRole("button", { name: "Route", exact: true }).click();
    await fromSaved.getByRole("button", { name: "Remove Opera from saved places" }).click();
    await expect(fromSaved.getByRole("button", { name: "Opera", exact: true })).toBeHidden();
    expect(saves.at(-1).savedPlaces.places).toHaveLength(1);
  }
);
