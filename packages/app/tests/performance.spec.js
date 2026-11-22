import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/google.js";

// Pages sample their traces at random: 0 always samples, 0.99 never does.
const withRandom = (page, value) =>
  page.addInitScript((fixed) => {
    Math.random = () => fixed;
  }, value);

const fakeTelemetryApi = async (page) => {
  const batches = [];
  await page.route("**/api/telemetry", (route) => {
    batches.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: {} });
  });
  return batches;
};

// The traceparent headers of the page's tile requests.
const watchTileHeaders = (page) => {
  const headers = [];
  page.on("request", (request) => {
    if (/\/api\/chargers\/\d+\//.test(request.url())) {
      headers.push(request.headers().traceparent);
    }
  });
  return headers;
};

const leavePage = (page) => page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
});

test("traces a sampled page's API calls and sends the spans with its Web Vitals", async ({
  page,
}) => {
  await withRandom(page, 0);
  const batches = await fakeTelemetryApi(page);
  const headers = watchTileHeaders(page);
  await page.goto("/en/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await leavePage(page);

  await expect.poll(() => batches.length).toBe(1);
  const { spans, vitals } = batches[0];
  const tileSpans = spans.filter((span) => span.name.startsWith("GET /api/chargers/"));
  expect(tileSpans.length).toBeGreaterThan(0);
  expect(tileSpans[0].name).toBe("GET /api/chargers/{id}/{id}/{id}");
  expect(tileSpans[0].attributes["http.response.status_code"]).toBe(200);
  expect(tileSpans[0].duration).toBeGreaterThanOrEqual(0);
  // The span is the parent of the Worker's: the same IDs in the header.
  expect(headers).toContain(`00-${tileSpans[0].traceId}-${tileSpans[0].spanId}-01`);
  // Measuring isn't measured.
  expect(spans.some((span) => /telemetry|usage|i18n/.test(span.name))).toBe(false);
  const names = vitals.map((vital) => vital.name);
  expect(names).toContain("TTFB");
  expect(names).toContain("FCP");
  expect(vitals.every((vital) => vital.pageKind === "home")).toBe(true);
});

test("tells the Worker not to sample an unsampled page's calls, and sends no spans", async ({
  page,
}) => {
  await withRandom(page, 0.99);
  const batches = await fakeTelemetryApi(page);
  const headers = watchTileHeaders(page);
  await page.goto("/en/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await leavePage(page);

  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0].spans).toEqual([]);
  expect(batches[0].vitals.length).toBeGreaterThan(0);
  expect(headers.length).toBeGreaterThan(0);
  expect(headers.every((header) => /^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/.test(header))).toBe(true);
});

test("measures no Web Vitals in the admin area", async ({ page }) => {
  await withRandom(page, 0.99);
  const batches = await fakeTelemetryApi(page);
  await page.route("**/api/admin/me", (route) => route.fulfill({ status: 403, json: {} }));
  await page.goto("/en/admin/");

  await leavePage(page);
  await page.waitForTimeout(300);

  expect(batches).toEqual([]);
});
