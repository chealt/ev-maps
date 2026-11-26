import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

const charger = {
  id: "ocm:1",
  source: "ocm",
  name: "Downtown charger",
  location: { lat: 40.7128, lng: -74.006 },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
};

const GOOGLE = "https://www.google.com/maps/search/?api=1&query=40.7128%2C-74.006";
const OSM = "https://www.openstreetmap.org/?mlat=40.7128&mlon=-74.006#map=18/40.7128/-74.006";
const APPLE = "https://maps.apple.com/?ll=40.7128,-74.006&q=Downtown%20charger";

// The maps apps' pages aren't loaded: a tab opened for one stays blank.
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .route(
      /^https:\/\/(www\.google\.com\/maps|www\.openstreetmap\.org|maps\.apple\.com)\//,
      (route) => route.fulfill({ contentType: "text/html", body: "<title>Maps app</title>" })
    );
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers: [charger] });
});

const openDetails = async (page) => {
  await page
    .getByRole("region", { name: "EV charging station map" })
    .getByRole("button", { name: "Downtown charger", exact: true })
    .click();
  return page.getByRole("complementary", { name: "Downtown charger" });
};

test("the address opens the charger in Google Maps in a new tab, Open map without one", async ({
  page,
}) => {
  await fakeAuthApi(page);
  await page.goto("/");
  const details = await openDetails(page);
  const link = details.getByRole("link", { name: "Open map" });
  await expect(link).toHaveAttribute("href", GOOGLE);
  await expect(link).toHaveAttribute("target", "_blank");
  const tab = page.context().waitForEvent("page");
  await link.click();
  expect((await tab).url()).toBe(GOOGLE);
});

test("opens the app chosen in the account menu, after a reload too", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  let details = await openDetails(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "Google Maps" })).toBeChecked();
  await expect(menu.getByRole("radio", { name: "Ask every time" })).toHaveCount(0);
  await menu.getByText("Apple Maps", { exact: true }).click();
  // The open charger's link follows at once.
  await expect(details.getByRole("link", { name: "Open map" })).toHaveAttribute("href", APPLE);

  await page.reload();
  details = await openDetails(page);
  const tab = page.context().waitForEvent("page");
  await details.getByRole("link", { name: "Open map" }).click();
  expect((await tab).url()).toBe(APPLE);
});

test("signed in, keeps the choice in the account, the newer one winning", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  // Another device chose OpenStreetMap.
  const saves = await fakeSettingsApi(page, {
    mapsApp: { app: "osm", updatedAt: Date.now() - 1000 },
  });
  await page.goto("/");
  const details = await openDetails(page);
  const link = details.getByRole("link", { name: "Open map" });
  await expect(link).toHaveAttribute("href", OSM);

  // Chosen here, in the account menu: saved to the account.
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByText("Google Maps", { exact: true })
    .click();
  await expect
    .poll(() => saves.map((save) => save.mapsApp?.app).filter((app) => app !== undefined))
    .toEqual(["google"]);
  await expect(link).toHaveAttribute("href", GOOGLE);
});
