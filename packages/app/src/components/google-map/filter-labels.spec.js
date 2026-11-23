import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

// The filters' option buttons whose label is wider than the button itself,
// e.g. "Hide unavailable" running past its rounded edge.
const overflowingOptions = (page) =>
  page
    .locator(".filter-dialog .options .button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.textContent.trim().replace(/\s+/g, " "))
    );

// A wider font than the page's, as a system font or a user's can be: the
// labels have to fit then too (the bug: "Household socket" didn't).
const useWideFont = (page) =>
  page.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "* { font-family: Verdana, sans-serif !important; }";
      document.head.append(style);
    })
  );

for (const lang of ["en", "hu", "pl"]) {
  for (const width of [375, 1024]) {
    test(`the filters' labels fit their buttons, in ${lang} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await useWideFont(page);
      await fakeGoogleMaps(page);
      await fakeChargersApi(page);
      await page.goto(`/${lang}/`);
      await page.locator(".map-controls .filter-button").click();
      await expect(page.locator(".filter-dialog")).toBeVisible();

      expect(await overflowingOptions(page)).toEqual([]);
    });
  }
}
