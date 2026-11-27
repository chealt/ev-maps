import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { PERFORMANCE_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const START = Date.UTC(2026, 10, 24, 10);

const summary = (days) => ({
  days,
  vitals: [
    { name: "LCP", count: 120, p75: 2100, rating: "good" },
    { name: "INP", count: 80, p75: 350, rating: "needs-improvement" },
    { name: "CLS", count: 120, p75: 0.31, rating: "poor" },
  ],
  requests: [{ name: "POST route", count: 12, p75: 840, p95: 1900, max: 2300, errors: 1 }],
  pageRequests: [],
  queries: [
    {
      name: "SELECT * FROM chargers_rtree WHERE ?",
      count: 300,
      p75: 6,
      p95: 40,
      max: 700,
      errors: 0,
    },
  ],
  vitalsByDay: {
    days: ["2026-11-22", "2026-11-23", "2026-11-24"],
    vitals: { LCP: { "2026-11-22": 3200, "2026-11-24": 2100 }, CLS: { "2026-11-23": 0 } },
  },
  slowestRequests: [
    {
      trace_id: TRACE,
      name: "POST route",
      duration: 2300,
      status: "ok",
      start_time: START,
      path: "/api/chargers/route",
    },
  ],
});

const spans = [
  {
    span_id: "a".repeat(16),
    parent_span_id: null,
    name: "POST /api/chargers/route",
    kind: "client",
    service: "page",
    start_time: START,
    duration: 2400,
    status: "ok",
    attributes: { "url.path": "/api/chargers/route" },
  },
  {
    span_id: "b".repeat(16),
    parent_span_id: "a".repeat(16),
    name: "POST route",
    kind: "server",
    service: "worker",
    start_time: START + 50,
    duration: 2300,
    status: "ok",
    attributes: { "url.path": "/api/chargers/route" },
  },
  {
    span_id: "c".repeat(16),
    parent_span_id: "b".repeat(16),
    name: "BATCH SELECT chargers_rtree",
    kind: "client",
    service: "d1",
    start_time: START + 100,
    duration: 1200,
    status: "ok",
    attributes: { "db.query.text": "SELECT * FROM chargers_rtree WHERE ?" },
  },
];

const fakePerformanceApi = async (page) => {
  const requests = [];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  // The page is rendered on the server with its data (in the tests, passed
  // in a header: src/lib/page-data.js).
  await fakePageData(page, PERFORMANCE_PAGE, (url) => {
    if (url.searchParams.get("trace") === TRACE) {
      return { data: { traceId: TRACE, spans } };
    }
    const days = Number(url.searchParams.get("days") ?? 7);
    requests.push(days);
    return { data: summary(days) };
  });
  return requests;
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
  });

  test(
    "shows the Web Vitals' P75s with their rating, and the timings",
    { tag: "@performance" },
    async ({ page }) => {
      await fakePerformanceApi(page);
      await page.goto("/en/admin/performance/");

      await expect(page.getByRole("heading", { level: 2, name: "Performance" })).toBeVisible();
      const lcp = page.locator('[data-vital="LCP"]');
      await expect(lcp.locator(".value")).toHaveText("2.1 s");
      await expect(lcp).toHaveAttribute("data-rating", "good");
      await expect(page.locator('[data-vital="INP"] .value')).toHaveText("350 ms");
      await expect(page.locator('[data-vital="INP"]')).toHaveAttribute(
        "data-rating",
        "needs-improvement"
      );
      await expect(page.locator('[data-vital="CLS"] .value')).toHaveText("0.31");
      await expect(page.locator('[data-vital="CLS"]')).toHaveAttribute("data-rating", "poor");
      await expect(page.locator('[data-vital="TTFB"] .value')).toHaveText("–");
      await expect(page.getByTitle("Largest Contentful Paint")).toBeVisible();

      const requests = page.getByRole("region", { name: "Requests, in the Worker" });
      await expect(requests.getByRole("row").nth(1)).toHaveText(
        /POST route\s*12\s*840 ms\s*1.9 s\s*2.3 s\s*1/
      );
      const queries = page.getByRole("region", { name: "Slowest database queries" });
      await expect(queries.getByRole("row").nth(1)).toContainText(
        "SELECT * FROM chargers_rtree WHERE ?"
      );
      await expect(
        page
          .getByRole("region", { name: "API calls, as the page saw them" })
          .getByText("Nothing yet.")
      ).toBeVisible();
    }
  );

  test("opens a slow request's trace as a waterfall, and goes back", async ({ page }) => {
    await fakePerformanceApi(page);
    await page.goto("/en/admin/performance/");
    const slowest = page.getByRole("region", { name: "Slowest requests" });

    await slowest.getByRole("link", { name: "POST route" }).click();

    await expect(page).toHaveURL(`/en/admin/performance/?trace=${TRACE}`);
    await expect(
      page.getByRole("heading", { level: 2, name: "POST /api/chargers/route" })
    ).toBeVisible();
    const waterfall = page.getByRole("list", { name: "Spans of the trace" });
    await expect(waterfall.getByRole("listitem")).toHaveCount(3);
    const query = waterfall.getByRole("listitem").nth(2);
    await expect(query).toContainText("d1");
    await expect(query).toContainText("1.2 s");
    await expect(query).toContainText("SELECT * FROM chargers_rtree WHERE ?");
    // Indented by depth: page → worker → d1.
    await expect(query).toHaveAttribute("style", /--depth: 2/);
    await expect(query.locator(".bar")).toHaveAttribute("style", /--width: 0\.5/);

    await page.getByRole("link", { name: "All performance" }).click();
    await expect(page).toHaveURL("/en/admin/performance/");
    await expect(page.locator('[data-vital="LCP"] .value')).toHaveText("2.1 s");
  });

  test("switches the period, and is in the admin navigation", async ({ page }) => {
    const requests = await fakePerformanceApi(page);
    await page.goto("/en/admin/");
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Performance" })
      .click();
    await expect(page).toHaveURL("/en/admin/performance/");
    await expect(page.getByText("The last 7 days")).toBeVisible();

    await page.getByText("Last 14 days", { exact: true }).click();

    await expect(page.getByText("The last 14 days")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Last 14 days" })).toBeChecked();
    expect(requests).toEqual([7, 14]);
  });

  test("charts each Web Vital's P75 per day", { tag: "@ui" }, async ({ page }) => {
    await fakePerformanceApi(page);
    await page.goto("/en/admin/performance/");

    const chart = page.getByRole("list", { name: "P75 per day, over 14 days" });
    await expect(chart.getByRole("listitem")).toHaveText([
      "Nov 22: 3.2 s",
      "Nov 23: no measurements",
      "Nov 24: 2.1 s",
    ]);

    // A day's real 0 is a measurement, not a gap.
    await page
      .getByRole("group", { name: "Web Vital to chart" })
      .getByText("CLS", { exact: true })
      .click();
    await expect(chart.getByRole("listitem")).toHaveText([
      "Nov 22: no measurements",
      "Nov 23: 0",
      "Nov 24: no measurements",
    ]);
    await expect(page.getByRole("radio", { name: "CLS" })).toBeChecked();
  });

  test("says when the performance couldn't be loaded", async ({ page }) => {
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
    await fakePageData(page, PERFORMANCE_PAGE, { failed: true });
    await page.goto("/en/admin/performance/");

    await expect(page.getByText("The performance couldn't be loaded. Try again.")).toBeVisible();
    await expect(page.locator('[data-vital="LCP"] .value')).toHaveText("–");
  });
});
