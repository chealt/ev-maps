import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";

// Every page is built in English (/en/), Polish (/pl/), Hungarian (/hu/) and
// Spanish (/es/).

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

test.describe("translations", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeAuthApi(page);
  });

  // The plural forms are unit tested (src/i18n/plurals.test.js).
  test("shows the pages in Polish: the map, its chargers, and the country pages", async ({
    page,
  }) => {
    const [unnamed] = fixtureChargers(1);
    await fakeChargersApi(page, {
      chargers: [
        ...fixtureChargers(2),
        { ...unnamed, id: "ocm:x", name: undefined, location: { lat: 40.79, lng: -74.02 } },
      ],
    });
    await page.goto("/pl/");
    await expect(page).toHaveTitle("EV Maps – stacje ładowania samochodów elektrycznych");
    await expect(page.getByRole("button", { name: "Zlokalizuj mnie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtry" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Znaleziono 3 stacje ładowania");
    // A charger without a name is named in the page's language.
    const map = page.getByRole("region", { name: "Mapa stacji ładowania" });
    await expect(map.getByRole("button", { name: "Stacja ładowania" })).toBeVisible();

    await page.goto("/pl/hu/");
    await expect(page).toHaveTitle("EV Maps – stacje ładowania – Węgry");
    await page.goto("/hu/hu/");
    await expect(page).toHaveTitle("EV Maps – elektromosautó-töltők – Magyarország");
  });

  test("shows the map, Google Maps and the country pages in Spanish", async ({ page }) => {
    const mapsRequest = page.waitForRequest("https://maps.googleapis.com/maps/api/js?**");
    await fakeChargersApi(page, { chargers: fixtureChargers(2) });
    await page.goto("/es/");
    expect(new URL((await mapsRequest).url()).searchParams.get("language")).toBe("es");
    await expect(page).toHaveTitle("EV Maps - Estaciones de carga para vehículos eléctricos");
    await expect(page.getByRole("button", { name: "Mi ubicación" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtros" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("2 cargadores encontrados");

    await page.goto("/es/hu/");
    await expect(page).toHaveTitle("EV Maps - Cargadores para vehículos eléctricos en Hungría");
  });

  test("shows a charger's details, Google Maps and sign-in in Hungarian", async ({ page }) => {
    const mapsRequest = page.waitForRequest("https://maps.googleapis.com/maps/api/js?**");
    await fakeChargersApi(page);
    await page.goto("/hu/");
    expect(new URL((await mapsRequest).url()).searchParams.get("language")).toBe("hu");

    const map = page.getByRole("region", { name: "Töltőállomások térképe" });
    await map.getByRole("button", { name: "Downtown Supercharger" }).click();
    const details = page.getByRole("complementary", { name: "Downtown Supercharger" });
    await expect(details.getByRole("heading", { name: "Csatlakozók" })).toBeVisible();
    await expect(
      details.getByRole("button", { name: "CCS (1-es típus): 4× · 150 kW" })
    ).toBeVisible();
    await expect(details.getByText("Hozzáférés: Nyilvános, tagság szükséges")).toBeVisible();
    await expect(details.getByText("Állapot: Működik")).toBeVisible();
    await expect(details.getByRole("link", { name: "Töltőadatok forrása" })).toBeVisible();
    await details.getByRole("button", { name: "Bezárás" }).click();

    await page.getByRole("button", { name: "Bejelentkezés" }).click();
    const menu = page.getByRole("dialog", { name: "Fiók" });
    await expect(menu.getByRole("button", { name: "Bejelentkezés Google-fiókkal" })).toBeVisible();
  });

  test("switches to another language from the account menu", async ({ page }) => {
    await fakeChargersApi(page);
    await page.goto("/en/hu/");
    await page.getByRole("button", { name: "Sign in" }).click();
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
});
