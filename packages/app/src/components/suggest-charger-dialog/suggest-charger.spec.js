import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
});

test(
  "signed-in user suggests a new charger location with multiple chargers and a proof photo",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true });
    const submitted = [];
    await page.route("**/api/charger-suggestions", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { submitted: true } });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await menu.getByRole("button", { name: "Suggest a charger" }).click();

    const dialog = page.getByRole("dialog", { name: "Suggest a charger" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Location name").fill("Harbor Charging Hub");
    await dialog.getByLabel("Address").fill("10 Dock Rd");
    await dialog.getByLabel("Operator").fill("Ionity");
    await dialog.getByLabel("Latitude").fill("47.5");
    await dialog.getByLabel("Longitude").fill("19.05");

    // Add a second charger unit with a different speed.
    await dialog.getByRole("button", { name: "Add charger" }).click();
    const unit1 = dialog.getByRole("group", { name: "Charger 1" });
    const unit2 = dialog.getByRole("group", { name: "Charger 2" });
    await unit1.getByLabel("Connector type").selectOption("ccs2");
    await unit1.getByLabel("Power (kW)").fill("350");
    await unit1.getByLabel("Quantity").fill("4");

    await unit2.getByLabel("Connector type").selectOption("type2");
    await unit2.getByLabel("Power (kW)").fill("22");
    await unit2.getByLabel("Quantity").fill("2");

    await dialog.getByLabel("Proof photo").setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: PHOTO_BUFFER,
    });
    await captureUi(page, testInfo, "suggest a charger form filled in");

    await dialog.getByRole("button", { name: "Submit suggestion" }).click();

    await expect(dialog.getByRole("status")).toHaveText(
      "Thank you! Your charger suggestion has been submitted for review."
    );
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      name: "Harbor Charging Hub",
      address: "10 Dock Rd",
      operator: "Ionity",
      location: { lat: 47.5, lng: 19.05 },
      connectors: [
        { type: "ccs2", powerKw: 350, quantity: 4 },
        { type: "type2", powerKw: 22, quantity: 2 },
      ],
    });
    expect(submitted[0].photo).toMatch(/^data:image\/png;base64,/);
  }
);

test("signed-out users see that signing in is required to suggest a charger", async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  const menu = page.getByRole("dialog", { name: "Account" });

  await expect(menu.getByRole("button", { name: "Suggest a charger" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await expect(menu.getByText("Sign in to suggest a new charger location.")).toBeVisible();
});
