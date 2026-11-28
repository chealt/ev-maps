import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const SITE = "https://ev.chealt.com";

// What search engines read (#456): the sitemap robots.txt points to, and
// each page's canonical address and languages.
test.describe("seo", () => {
  test("lists the indexable pages in the sitemap, which robots.txt points to", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);

    const response = await request.get("/sitemap.xml");
    expect(response.headers()["content-type"]).toContain("xml");
    const sitemap = await response.text();
    for (const url of ["/en/", "/pl/", "/en/hu/", "/hu/hu/", "/de/privacy/", "/en/terms/"]) {
      expect(sitemap).toContain(`<loc>${SITE}${url}</loc>`);
    }
    // Pages with noindex aren't in it.
    expect(sitemap).not.toContain("/admin/");
    expect(sitemap).not.toContain("/places/");
    expect(sitemap).not.toContain("/suggestions/");
  });

  test("gives a page its canonical address and its languages", async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeAuthApi(page);
    await fakeChargersApi(page);
    await page.goto("/pl/hu/?utm_source=test");
    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/pl/hu/`);
    await expect(head.locator('link[hreflang="de"]')).toHaveAttribute("href", `${SITE}/de/hu/`);
    await expect(head.locator('link[hreflang="x-default"]')).toHaveAttribute(
      "href",
      `${SITE}/en/hu/`
    );
  });

  test("gives noindex pages no canonical address", async ({ page }) => {
    await fakeAuthApi(page);
    await page.goto("/en/places/");
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  });
});
