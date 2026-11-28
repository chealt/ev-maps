import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { SPONSORS_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };

// The period's days, oldest first, ending on 2026-11-23.
const daysOf = (period) =>
  Array.from({ length: period }, (_, index) =>
    new Date(Date.UTC(2026, 10, 23) - (period - 1 - index) * 86_400_000).toISOString().slice(0, 10)
  );

// The Worker's sponsor stats (packages/worker/src/sponsor-stats.js): the
// page is rendered on the server with them (in the tests, passed in a
// header: src/lib/page-data.js).
const stats = (period) => ({
  period,
  days: daysOf(period),
  platforms: [
    {
      id: "github-sponsors",
      clicks: 8,
      byDay: { "2026-11-22": 5, "2026-11-23": 3 },
      oneTime: 1,
      monthly: 1,
      sponsors: 2,
      ratio: 0.25,
    },
    {
      id: "ko-fi",
      clicks: 12,
      byDay: { "2026-11-20": 12 },
      oneTime: 0,
      monthly: 1,
      sponsors: 1,
      ratio: 1 / 12,
    },
    { id: "buycoffee", clicks: 0, byDay: {}, oneTime: 0, monthly: 0, sponsors: 0, ratio: null },
  ],
  totals: { clicks: 20, oneTime: 1, monthly: 2, sponsors: 3, ratio: 0.15 },
});

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
  });

  test(
    "shows the support links' clicks and the new sponsors",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakePageData(page, SPONSORS_PAGE, (url) => ({
        data: stats(Number(url.searchParams.get("days")) || 90),
      }));
      await page.goto("/en/admin/sponsors/");

      const nav = page.getByRole("navigation", { name: "Admin" });
      await expect(nav.getByRole("link", { name: "Sponsors" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await expect(page.getByRole("heading", { level: 2, name: "Sponsors" })).toBeVisible();
      await expect(page.getByText("Aug 26 – Nov 23")).toBeVisible();
      await expect(page.locator('[data-total="clicks"] .value')).toHaveText("20");
      await expect(page.locator('[data-total="monthly"] .value')).toHaveText("2");
      await expect(page.locator('[data-total="ratio"] .value')).toHaveText("15%");

      const table = page.getByRole("table", { name: "Per platform" });
      await expect(table.getByRole("row")).toHaveText([
        /Platform/,
        /GitHub Sponsors\s*8\s*1\s*1\s*25%/,
        /Ko-fi\s*12\s*0\s*1\s*8\.3%/,
        /buycoffee\.to\s*0\s*0\s*0\s*–/,
      ]);
      await expect(
        page.getByRole("heading", { name: "GitHub Sponsors clicks per day" })
      ).toBeVisible();
      await captureUi(page, testInfo, "admin sponsors");

      await page.getByText("Last 30 days").click();
      await expect(page).toHaveURL("/en/admin/sponsors/?days=30");
      await expect(page.getByText("Oct 25 – Nov 23")).toBeVisible();
    }
  );

  test("says when the sponsor stats couldn't be loaded", async ({ page }) => {
    await fakePageData(page, SPONSORS_PAGE, { failed: true });
    await page.goto("/en/admin/sponsors/");

    await expect(page.getByText("The sponsor stats couldn't be loaded. Try again.")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});
