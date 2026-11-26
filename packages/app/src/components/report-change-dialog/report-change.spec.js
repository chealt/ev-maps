import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// At the charger (40.71, -74.0): about 50 m away.
test.use({
  geolocation: { latitude: 40.7104, longitude: -74.0, accuracy: 12 },
  permissions: ["geolocation"],
});

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
});

test(
  "reports a charger's new availability and price, with the device's location and photos",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true });
    const submitted = [];
    await page.route("**/api/charger-reports", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { submitted: true, id: 1 } });
    });
    await page.goto("/");
    await page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button", { name: "Downtown Supercharger", exact: true })
      .click();
    await page
      .getByRole("complementary", { name: "Downtown Supercharger" })
      .getByRole("button", { name: "Report a change" })
      .click();

    const dialog = page.getByRole("dialog", { name: "Report a change" });
    await expect(dialog.getByText("Downtown Supercharger")).toBeVisible();
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose what changed: the availability, the price, or both."
    );

    await dialog.getByLabel("Availability").selectOption("temporarily-unavailable");
    await dialog.getByLabel("Price", { exact: true }).selectOption("kwh");
    await dialog.getByLabel("Amount").fill("0.45");
    await dialog.getByLabel("Currency").selectOption("USD");
    await dialog.getByRole("button", { name: "Share my location" }).click();
    await expect(dialog.getByText("Location shared (±12 m)")).toBeVisible();
    await dialog.locator(".charger-photos input").setInputFiles({
      name: "charger.png",
      mimeType: "image/png",
      buffer: PHOTO_BUFFER,
    });
    // A price needs a photo that shows it.
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Add a photo of the receipt, invoice or charging app that shows the price."
    );
    await dialog.locator(".receipt-photos input").setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: PHOTO_BUFFER,
    });
    await expect(dialog.getByRole("button", { name: "Remove photo" })).toHaveCount(2);
    await captureUi(page, testInfo, "reporting a change to a charger");

    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByRole("status").last()).toHaveText(
      "Thank you! Your report has been sent for review."
    );
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      chargerId: "ocm:1001",
      availability: "temporarily-unavailable",
      price: { amount: 0.45, currency: "USD", unit: "kwh" },
      deviceLocation: { lat: 40.7104, lng: -74.0, accuracy: 12 },
    });
    // Scaled down and sent as JPEGs, without their EXIF data.
    expect(submitted[0].chargerPhotos).toEqual([
      expect.stringMatching(/^data:image\/jpeg;base64,/),
    ]);
    expect(submitted[0].receiptPhotos).toEqual([
      expect.stringMatching(/^data:image\/jpeg;base64,/),
    ]);
  }
);
