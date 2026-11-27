import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const PHOTO = { name: "charger.png", mimeType: "image/png", buffer: PHOTO_BUFFER };

test.describe("suggestions", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page);
  });

  const openDialog = async (page) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button", { name: "Downtown Supercharger", exact: true })
      .click();
    await page
      .getByRole("complementary", { name: "Downtown Supercharger" })
      .getByRole("button", { name: "Report unavailable" })
      .click();
    return page.getByRole("dialog", { name: "Report unavailable" });
  };

  test(
    "flags a charger as unavailable with one photo of it",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeAuthApi(page, { signedIn: true });
      const submitted = [];
      await page.route("**/api/charger-unavailability", async (route) => {
        submitted.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: { submitted: true, id: 1 } });
      });
      const dialog = await openDialog(page);
      await expect(dialog.getByText("Downtown Supercharger")).toBeVisible();

      await dialog.locator(".unavailable-photo input").setInputFiles(PHOTO);
      await expect(dialog.getByRole("button", { name: "Remove photo" })).toHaveCount(1);
      // One photo at most.
      await dialog.locator(".unavailable-photo input").setInputFiles(PHOTO);
      await expect(dialog.getByRole("alert")).toHaveText("You've added as many photos as you can.");
      await expect(dialog.getByRole("button", { name: "Remove photo" })).toHaveCount(1);
      await captureUi(page, testInfo, "reporting a charger unavailable");

      await dialog.getByRole("button", { name: "Send report" }).click();
      await expect(dialog.getByRole("status").last()).toHaveText(
        "Thank you! Your report has been sent for review."
      );
      expect(submitted).toEqual([
        { chargerId: "ocm:1001", photo: expect.stringMatching(/^data:image\/jpeg;base64,/) },
      ]);
    }
  );

  test("flags a charger as unavailable without a photo", async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true });
    const submitted = [];
    await page.route("**/api/charger-unavailability", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { submitted: true, id: 2 } });
    });
    const dialog = await openDialog(page);
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByRole("status").last()).toHaveText(
      "Thank you! Your report has been sent for review."
    );
    expect(submitted).toEqual([{ chargerId: "ocm:1001", photo: null }]);
  });

  test("asks to sign in before flagging a charger", async ({ page }) => {
    await fakeAuthApi(page);
    await page.goto("/");
    await page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button", { name: "Downtown Supercharger", exact: true })
      .click();
    const button = page
      .getByRole("complementary", { name: "Downtown Supercharger" })
      .getByRole("button", { name: "Report unavailable" });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toHaveAccessibleDescription(
      "Sign in to report that this charger is unavailable."
    );
    await button.click({ force: true });
    await expect(
      page
        .getByRole("dialog", { name: "Account" })
        .getByRole("button", { name: "Sign in with Google" })
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Report unavailable" })).toBeHidden();
  });
});
