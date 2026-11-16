import { expect, test } from "@playwright/test";
import { fakeGoogleIdentity, fakeGoogleMaps } from "./fixtures/google.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";

// Every page is built in English (/en/), Polish (/pl/) and Hungarian (/hu/).

const fixtureChargers = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `ocm:${index}`,
    source: "ocm",
    name: `Charger ${index + 1}`,
    location: { lat: 40.71 + index * 0.001, lng: -74.0 },
    address: "",
    maxPowerKw: 50,
    connectors: [],
  }));

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeGoogleIdentity(page);
});

test("shows the page in Polish", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/pl/");

  await expect(page).toHaveTitle("EV Maps – stacje ładowania samochodów elektrycznych");
  await expect(page.getByRole("button", { name: "Zlokalizuj mnie" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtry" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Znaleziono 2 stacje ładowania");
});

for (const { count, text } of [
  { count: 1, text: "Znaleziono 1 stację ładowania" },
  { count: 3, text: "Znaleziono 3 stacje ładowania" },
  { count: 5, text: "Znaleziono 5 stacji ładowania" },
  { count: 22, text: "Znaleziono 22 stacje ładowania" },
]) {
  test(`uses the Polish plural form for ${count}`, async ({ page }) => {
    await fakeChargersApi(page, { chargers: fixtureChargers(count) });
    await page.goto("/pl/");

    await expect(page.getByRole("status")).toHaveText(text);
  });
}

test("shows charger details in Hungarian", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/hu/");
  const map = page.getByRole("region", { name: "Töltőállomások térképe" });

  await map.getByRole("button", { name: "Downtown Supercharger" }).click();

  const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
  await expect(details.getByRole("heading", { name: "Csatlakozók" })).toBeVisible();
  await expect(details.getByText("CCS (1-es típus): 4× · 150 kW")).toBeVisible();
  await expect(details.getByText("Hozzáférés: Nyilvános, tagság szükséges")).toBeVisible();
  await expect(details.getByText("Állapot: Működik")).toBeVisible();
  await expect(details.getByText("Töltőpontok: 8")).toBeVisible();
  await expect(details.getByText("A töltőadatok forrása:")).toBeVisible();
});

test("names a charger without a name in the page's language", async ({ page }) => {
  const [charger] = fixtureChargers(1);
  await fakeChargersApi(page, { chargers: [{ ...charger, name: undefined }] });
  await page.goto("/pl/");
  const map = page.getByRole("region", { name: "Mapa stacji ładowania" });

  await expect(map.getByRole("button", { name: "Stacja ładowania" })).toBeVisible();
});

test("builds the country pages in every language", async ({ page }) => {
  await page.goto("/pl/hu/");
  await expect(page).toHaveTitle("Stacje ładowania – Węgry – EV Maps");
  await expect(page.getByRole("status")).toHaveText("Znaleziono 4 stacje ładowania");

  await page.goto("/hu/hu/");
  await expect(page).toHaveTitle("Elektromosautó-töltők – Magyarország – EV Maps");
});

test("loads Google Maps and Google sign-in in the page's language", async ({ page }) => {
  const mapsRequest = page.waitForRequest("https://maps.googleapis.com/maps/api/js?**");
  await fakeChargersApi(page);
  await page.goto("/hu/");

  expect(new URL((await mapsRequest).url()).searchParams.get("language")).toBe("hu");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  expect(await page.evaluate(() => window.__gsi.buttonOptions.locale)).toBe("hu");
});

test("switches to another language from the account menu", async ({ page }) => {
  await fakeChargersApi(page);
  await page.goto("/en/hu/");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  const languages = page
    .getByRole("dialog", { name: "Account" })
    .getByRole("navigation", { name: "Language" });
  await expect(languages.getByRole("link", { name: "English" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await languages.getByRole("link", { name: "Polski" }).click();

  await expect(page).toHaveURL("/pl/hu/");
  await expect(page.getByRole("button", { name: "Zlokalizuj mnie" })).toBeVisible();
  // The Worker redirects / to the picked language (packages/worker).
  const cookies = await page.context().cookies();
  expect(cookies).toContainEqual(
    expect.objectContaining({ name: "ev-maps-language", value: "pl" })
  );
});
