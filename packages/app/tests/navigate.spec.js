import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

const charger = {
  id: "ocm:1",
  source: "ocm",
  name: "Harbor charger",
  location: { lat: 40.7128, lng: -73.9 },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers: [charger] });
  await page.goto("/");
});

test("links to directions to the charger in Google Maps", { tag: "@ui" }, async ({ page }) => {
  const map = page.getByRole("region", { name: "EV charging station map" });
  await map.getByRole("button", { name: "Harbor charger" }).click();
  const details = page.getByRole("complementary", { name: "Harbor charger" });

  const navigate = details.getByRole("link", { name: "Navigate" });
  // No origin: Google Maps starts from where the user is, if they allow it.
  await expect(navigate).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=40.7128,-73.9"
  );
  await expect(navigate).toHaveAttribute("target", "_blank");
  await expect(navigate).toHaveAccessibleDescription(
    "Opens Google Maps in a new tab, from where you are."
  );
});
