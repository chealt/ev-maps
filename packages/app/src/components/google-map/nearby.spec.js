import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, name, [lat, lng], amenities) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
  amenities,
});

const chargers = [
  charger(1, "Café stop", [40.71, -74.0], ["coffee"]),
  charger(2, "Service area", [40.75, -73.95], ["coffee", "toilets", "restaurant"]),
  charger(3, "Park charger", [40.79, -74.02], ["playground", "toilets"]),
  charger(4, "Lonely charger", [40.68, -74.05], undefined),
];

const openFilters = async (page) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  return page.getByRole("dialog", { name: "Filters" });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers });
});

test("shows only chargers with every chosen kind of place nearby", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const dialog = await openFilters(page);
  const nearby = dialog.getByRole("group", { name: "Nearby" });

  await nearby.getByRole("button", { name: "Café" }).click();
  await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");

  await nearby.getByRole("button", { name: "Toilets" }).click();
  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  await dialog.getByRole("button", { name: "Done" }).click();
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "Service area" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Café stop" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("2 filters on");
});

test("saves the chosen places with the filters", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  const dialog = await openFilters(page);

  await dialog.getByRole("button", { name: "Playground" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].filters.nearby).toEqual(["playground"]);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
});

test("asks to sign in for the nearby places when signed out", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  const dialog = await openFilters(page);
  const coffee = dialog.getByRole("button", { name: "Café" });

  await expect(coffee).toHaveAttribute("aria-disabled", "true");
  await expect(coffee).toHaveAccessibleDescription(
    "Sign in to find chargers with places next to them."
  );
  await coffee.click({ force: true });

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  await expect(
    page
      .getByRole("dialog", { name: "Account" })
      .getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
});

test(
  "lists the places next to a charger, crediting OpenStreetMap",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeAuthApi(page);
    await page.goto("/");
    const map = page.getByRole("region", { name: "EV charging station map" });

    await map.getByRole("button", { name: "Service area" }).click();

    const details = page.getByRole("complementary", { name: "Service area" });
    const nearby = details.locator(".nearby");
    await expect(nearby.getByRole("heading", { name: "Nearby" })).toBeVisible();
    await expect(nearby.getByRole("listitem")).toHaveText(["Café", "Toilets", "Restaurant"]);
    await expect(details.getByText("Nearby places ©")).toBeVisible();
    await captureUi(page, testInfo, "nearby places");

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await map.getByRole("button", { name: "Lonely charger" }).click();
    const lonely = page.getByRole("complementary", { name: "Lonely charger" });
    await expect(lonely.locator(".nearby")).toBeHidden();
    await expect(lonely.getByText("Nearby places ©")).toBeHidden();
  }
);
