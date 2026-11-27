import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { USAGE_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };

const daysUpTo = (count, last = "2026-11-23") =>
  Array.from({ length: count }, (_, index) =>
    new Date(Date.parse(`${last}T00:00:00Z`) - (count - 1 - index) * 86400000)
      .toISOString()
      .slice(0, 10)
  );

// The Worker's usage stats for the page's ?days= (30 by default): the page
// is rendered on the server with them (in the tests, passed in a header:
// src/lib/page-data.js).
const fakeUsageAdminApi = async (page) => {
  const requests = [];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  await fakePageData(page, USAGE_PAGE, (url) => {
    const days = Number(url.searchParams.get("days") ?? 30);
    requests.push(days);
    const dayList = daysUpTo(days);
    const byDay = Object.fromEntries(dayList.map((day) => [day, 0]));
    byDay[dayList.at(-1)] = 40;
    byDay[dayList.at(-2)] = 10;
    return {
      data: {
        period: days,
        days: dayList,
        events: {
          page_view: {
            total: 50,
            byDay,
            byDimension: { "hu:country": 30, "en:home": 20 },
          },
          visitor_country: { total: 50, byDay, byDimension: { HU: 45, PL: 5 } },
          sign_in: { total: 3, byDay, byDimension: {} },
          sign_in_started: { total: 4, byDay, byDimension: { passkey: 3, google: 1 } },
        },
        top: [
          { id: "ocm:1", name: "Downtown Supercharger", count: 2 },
          { id: "eipa:2", name: null, count: 1 },
        ],
      },
    };
  });
  return requests;
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
  });

  test(
    "shows the totals, page views per day and the breakdowns",
    { tag: "@performance" },
    async ({ page }) => {
      await fakeUsageAdminApi(page);
      await page.goto("/en/admin/usage/");

      await expect(page.getByRole("heading", { level: 2, name: "Usage" })).toBeVisible();
      await expect(page.getByText("Oct 25 – Nov 23")).toBeVisible();
      const totals = page.locator(".totals");
      await expect(totals.locator('[data-event="page_view"] .value')).toHaveText("50");
      await expect(totals.locator('[data-event="sign_in"] .value')).toHaveText("3");
      await expect(totals.locator('[data-event="route_planned"] .value')).toHaveText("0");

      const chart = page.getByRole("list", { name: "Page views per day" });
      await expect(chart.getByRole("listitem")).toHaveCount(30);
      await expect(chart.getByRole("listitem").last()).toHaveText("Nov 23: 40");

      const pages = page.getByRole("region", { name: "Page views" });
      await expect(pages.getByRole("row")).toHaveText([
        "Hungarian, country page30",
        "English, home page20",
      ]);
      const countries = page.getByRole("region", { name: "Visitors' countries" });
      await expect(countries.getByRole("row")).toHaveText(["Hungary45", "Poland5"]);
      const signIns = page.getByRole("region", { name: "Sign-in attempts" });
      await expect(signIns.getByRole("row")).toHaveText(["Passkey3", "Google1"]);
      await expect(
        page.getByRole("region", { name: "Filters used" }).getByText("Nothing yet.")
      ).toBeVisible();
      // Without a saved name, an item shows its ID.
      const top = page.getByRole("region", { name: "Most favorited chargers, now" });
      await expect(top.getByRole("row")).toHaveText([
        "Downtown Supercharger2 users",
        "eipa:21 user",
      ]);
    }
  );

  test("switches the period", async ({ page }) => {
    const requests = await fakeUsageAdminApi(page);
    await page.goto("/en/admin/usage/");
    await expect(page.getByRole("radio", { name: "Last 30 days" })).toBeChecked();

    await page.getByText("Last 7 days", { exact: true }).click();

    await expect(page.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
    await expect(
      page.getByRole("list", { name: "Page views per day" }).getByRole("listitem")
    ).toHaveCount(7);
    expect(requests).toEqual([30, 7]);
  });

  test("says when the stats couldn't be loaded", async ({ page }) => {
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
    await fakePageData(page, USAGE_PAGE, { failed: true });
    await page.goto("/en/admin/usage/");

    await expect(page.getByRole("status").filter({ hasText: "couldn't be loaded" })).toBeVisible();
    await expect(page.locator(".totals")).toHaveCount(0);
  });

  test("is in the admin navigation and overview", async ({ page }) => {
    await fakeUsageAdminApi(page);
    await page.goto("/en/admin/");

    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Usage" })
      .click();

    await expect(page).toHaveURL("/en/admin/usage/");
    // Its first subsection, Activity, is the current page; Usage is its group.
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Usage" })).toHaveAttribute("data-current", "");
    await expect(nav.getByRole("link", { name: "Activity" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
