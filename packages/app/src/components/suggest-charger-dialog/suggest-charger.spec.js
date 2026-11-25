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
    await dialog.getByRole("combobox", { name: "Address / Place lookup" }).fill("Buda");
    await dialog.getByRole("option", { name: "Budapest, Hungary" }).click();
    await dialog.getByLabel("Operator").selectOption("Ionity");

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

    await dialog.locator(".charger-photo").setInputFiles([
      { name: "proof.png", mimeType: "image/png", buffer: PHOTO_BUFFER },
      { name: "proof-2.png", mimeType: "image/png", buffer: PHOTO_BUFFER },
    ]);
    await expect(dialog.locator(".photo-item")).toHaveCount(2);

    // Removing a photo updates the previews.
    await dialog.getByRole("button", { name: "Remove photo" }).last().click();
    await expect(dialog.locator(".photo-item")).toHaveCount(1);
    await dialog.locator(".charger-photo").setInputFiles({
      name: "proof-2.png",
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
      address: "Budapest, Hungary",
      operator: "Ionity",
      location: { lat: 47.4979, lng: 19.0402 },
      connectors: [
        { type: "ccs2", powerKw: 350, quantity: 4 },
        { type: "type2", powerKw: 22, quantity: 2 },
      ],
    });
    expect(submitted[0].photo).toMatch(/^data:image\/png;base64,/);
    expect(submitted[0].photos).toHaveLength(2);
    expect(submitted[0].photos[0]).toBe(submitted[0].photo);
  }
);

test(
  "signed-in user views their suggested chargers page from the account menu and filters by status",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeAuthApi(page, { signedIn: true });
    const suggestions = [
      {
        id: 1,
        name: "Harbor Charging Hub",
        address: "10 Dock Rd",
        operator: "Ionity",
        location: { lat: 47.5, lng: 19.05 },
        connectors: [{ type: "ccs2", powerKw: 350, quantity: 4 }],
        photoUrl: "/api/charger-suggestions/1/photo",
        photoUrls: [
          "/api/charger-suggestions/1/photo?index=0",
          "/api/charger-suggestions/1/photo?index=1",
        ],
        status: "pending",
      },
      {
        id: 2,
        name: "Airport Fast Charger",
        address: "1 Terminal Way",
        operator: "Tesla",
        location: { lat: 47.43, lng: 19.25 },
        connectors: [{ type: "type2", powerKw: 22, quantity: 2 }],
        photoUrl: "/api/charger-suggestions/2/photo",
        status: "approved",
      },
      {
        id: 3,
        name: "Old Mall Charger",
        address: "5 Market St",
        operator: "GreenWay",
        location: { lat: 47.49, lng: 19.08 },
        connectors: [{ type: "chademo", powerKw: 50, quantity: 1 }],
        photoUrl: "/api/charger-suggestions/3/photo",
        status: "rejected",
      },
    ];
    await page.route("**/api/charger-suggestions/*/photo", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: PHOTO_BUFFER,
      })
    );
    await page.route("**/api/charger-suggestions**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/photo")) {
        return route.fallback();
      }
      const status = url.searchParams.get("status");
      const shown = status ? suggestions.filter((item) => item.status === status) : suggestions;
      return route.fulfill({ json: { suggestions: shown } });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
    const menu = page.getByRole("dialog", { name: "Account" });
    await expect(menu.getByRole("link", { name: "My suggested chargers" })).toBeVisible();
    await captureUi(page, testInfo, "account menu with My suggested chargers");
    await menu.getByRole("link", { name: "My suggested chargers" }).click();

    await expect(page).toHaveURL("/en/suggestions/");
    await expect(
      page.getByRole("heading", { level: 1, name: "My suggested chargers" })
    ).toBeVisible();
    await expect(page.getByText("3 suggested chargers")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Harbor Charging Hub" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Airport Fast Charger" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Old Mall Charger" })).toBeVisible();
    const harborCard = page.getByRole("article").filter({ hasText: "Harbor Charging Hub" });
    await expect(harborCard.locator(".proof-photo")).toHaveCount(2);
    await captureUi(page, testInfo, "user viewing their suggested chargers (All)");

    const statusSelect = page.getByRole("combobox", { name: "Status" });
    await statusSelect.selectOption({ label: "Pending" });
    await expect(page.getByText("1 suggested charger")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Harbor Charging Hub" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Airport Fast Charger" })
    ).toBeHidden();

    await statusSelect.selectOption({ label: "Approved" });
    await expect(
      page.getByRole("heading", { level: 2, name: "Airport Fast Charger" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Harbor Charging Hub" })).toBeHidden();
    await captureUi(page, testInfo, "user filtering suggested chargers by Approved");

    await statusSelect.selectOption({ label: "Rejected" });
    await expect(page.getByRole("heading", { level: 2, name: "Old Mall Charger" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Airport Fast Charger" })
    ).toBeHidden();
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
  await expect(menu.getByRole("link", { name: "My suggested chargers" })).toBeHidden();
});
