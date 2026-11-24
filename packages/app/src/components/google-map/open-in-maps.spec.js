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

test("lists the maps apps, each opening the charger in a new tab", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  const details = await openDetails(page);

  const button = details.getByRole("button", { name: "Open map" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const google = details.getByRole("link", { name: "Google Maps" });
  await expect(google).toHaveAttribute("href", GOOGLE);
  await expect(google).toHaveAttribute("target", "_blank");
  await expect(details.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", OSM);
  await expect(details.getByRole("link", { name: "Apple Maps" })).toHaveAttribute("href", APPLE);

  // Without "Remember my choice", it asks again next time.
  const tab = page.context().waitForEvent("page");
  await details.getByRole("link", { name: "OpenStreetMap" }).click();
  expect((await tab).url()).toBe(OSM);
  await expect(details.getByRole("link", { name: "OpenStreetMap" })).toBeHidden();
  await expect(details.getByRole("button", { name: "Open map" })).toBeVisible();
});

test("remembers the app chosen, opens it at once, and forgets it in the account menu", async ({
  page,
}) => {
  await fakeAuthApi(page);
  await page.goto("/");
  let details = await openDetails(page);
  await details.getByRole("button", { name: "Open map" }).click();
  await details.getByRole("checkbox", { name: "Remember my choice" }).check();
  const first = page.context().waitForEvent("page");
  await details.getByRole("link", { name: "Apple Maps" }).click();
  expect((await first).url()).toBe(APPLE);

  // Remembered, after a reload too: the button opens it at once.
  await page.reload();
  details = await openDetails(page);
  const button = details.getByRole("button", { name: "Open in Apple Maps" });
  await expect(button).not.toHaveAttribute("aria-expanded");
  const second = page.context().waitForEvent("page");
  await button.click();
  expect((await second).url()).toBe(APPLE);
  await expect(details.getByRole("link", { name: "Apple Maps" })).toBeHidden();

  // The account menu shows it, and can go back to asking.
  await page.getByRole("button", { name: "Sign in" }).click();
  const menu = page.getByRole("dialog", { name: "Account" });
  await expect(menu.getByRole("radio", { name: "Apple Maps" })).toBeChecked();
  await menu.getByRole("radio", { name: "Ask every time" }).check();
  // Closed with its button (Escape would close the details too).
  await page.locator('[popovertarget="account-menu"]').click();
  details = await openDetails(page);
  await expect(details.getByRole("button", { name: "Open map" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

test("signed in, keeps the choice in the account, the newer one winning", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  // Another device remembered OpenStreetMap.
  const saves = await fakeSettingsApi(page, {
    mapsApp: { app: "osm", updatedAt: Date.now() - 1000 },
  });
  await page.goto("/");
  let details = await openDetails(page);
  await expect(details.getByRole("button", { name: "Open in OpenStreetMap" })).toBeVisible();

  // Chosen here, in the account menu: saved to the account.
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("radio", { name: "Google Maps" })
    .check();
  await expect
    .poll(() => saves.map((save) => save.mapsApp?.app).filter((app) => app !== undefined))
    .toEqual(["google"]);
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  details = await openDetails(page);
  await expect(details.getByRole("button", { name: "Open in Google Maps" })).toBeVisible();
});
