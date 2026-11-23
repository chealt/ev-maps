import { expect, test } from "@ev-maps/e2e/test.js";
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

test("shows the chargers along a route", { tag: "@regression" }, async ({ page }) => {
  const routeRequests = await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });

  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("2 EV chargers along the route");
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
});

test("lists the chargers in order along the route", { tag: "@ui" }, async ({ page }) => {
  await fakeRouteChargersApi(page);
  await page.getByRole("button", { name: "Route" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan a route" });
  await choosePlace(dialog, "From", "Buda", "Budapest, Hungary");
  await choosePlace(dialog, "To", "Vie", "Vienna, Austria");
  await dialog.getByRole("button", { name: "Show route" }).click();

  await page.getByRole("button", { name: "2 EV chargers along the route" }).click();

  const list = page.getByRole("dialog", { name: "2 EV chargers" });
  await expect(list.getByText("In order along the route")).toBeVisible();
  const entries = list.getByRole("listitem");
  await expect(entries.nth(0)).toContainText("Downtown Supercharger");
  // Each distance says what it is: from the start, to the end, off the route.
  await expect(entries.nth(0)).toContainText(
    "50 km from the start100 km to the end1 km off the route"
  );
  await expect(entries.nth(1)).toContainText(
    "100 km from the start50 km to the end1 km off the route"
  );
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
  // The same places, by their IDs, and in the route planner.
  const [routeRequest] = await page.evaluate(() => window.__routeRequests);
  expect(routeRequest).toMatchObject({ origin: { id: "budapest" }, destination: { id: "vienna" } });
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "From" })).toHaveValue("Budapest, Hungary");
  await expect(dialog.getByRole("combobox", { name: "To" })).toHaveValue("Vienna, Austria");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Clear route" }).click();
  await page.reload();

  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");
  await expect(page.getByRole("button", { name: "Clear route" })).toBeHidden();
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
    recent.getByRole("button", { name: /Budapest, Hungary → Vienna, Austria/ })
  ).toHaveText(/.*1 filter on.*/);
  await recent.getByRole("button", { name: /Budapest, Hungary → Vienna, Austria/ }).click();

  await expect(page.getByRole("status")).toHaveText(
    "1 of 2 EV chargers along the route match the filters"
  );
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("1 filter on");
});
