import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";
import { ERRORS_PAGE, fakePageData } from "./fixtures/page-data.js";

// Scrolls the page down with the mouse wheel, as a person would (code can
// scroll even where they can't), and says how far it went.
const scrolledBy = async (page) => {
  await page.mouse.move(180, 200);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  return page.evaluate(() => window.scrollY);
};

test.use({ viewport: { width: 360, height: 400 } });

test("scrolls the admin pages", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: "grace@chealt.com" } })
  );
  await fakePageData(page, ERRORS_PAGE, {
    data: {
      groups: Array.from({ length: 25 }, (_, index) => ({
        fingerprint: index.toString(16).padStart(8, "0"),
        source: "page",
        name: "TypeError",
        message: `Error ${index}`,
        url: "/en/",
        context: null,
        count: 1,
        users: 0,
        first_seen: Date.now(),
        last_seen: Date.now(),
      })),
      page: 1,
      pages: 1,
      total: 25,
    },
  });
  await page.goto("/en/admin/errors/");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(26);

  expect(await scrolledBy(page)).toBeGreaterThan(0);
});

test("scrolls the legal pages", async ({ page }) => {
  await page.goto("/en/privacy/");

  expect(await scrolledBy(page)).toBeGreaterThan(0);
});

test("keeps the map page from scrolling", async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
  await page.goto("/en/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  expect(await scrolledBy(page)).toBe(0);
});
