import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { CHARGER_REPORTS_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// The page is rendered on the server with the reports of its ?status=
// (pending by default; in the tests, passed in a header:
// src/lib/page-data.js); approving or rejecting one goes to the API.
const fakeReportsApi = async (page) => {
  const reports = [
    {
      id: 1,
      userEmail: "ada@example.com",
      chargerId: "ocm:42",
      chargerName: "Harbor Charging Hub",
      currentStatus: "operational",
      currentCost: "€0.39/kWh",
      availability: "temporarily-unavailable",
      price: { amount: 0.45, currency: "EUR", unit: "kwh" },
      deviceLocation: { lat: 47.50027, lng: 19.05, accuracy: 12 },
      distanceM: 30,
      trustScore: 65,
      trustFactors: [
        { id: "location", points: 30 },
        { id: "chargerPhoto", points: 15 },
        { id: "receiptPhoto", points: 15 },
        { id: "approvedBefore", points: 5 },
        { id: "rejectedBefore", points: 0 },
      ],
      photos: [
        { kind: "charger", url: "/api/charger-reports/1/photos/0" },
        { kind: "receipt", url: "/api/charger-reports/1/photos/1" },
      ],
      status: "pending",
      createdAt: Date.UTC(2026, 10, 24, 12),
    },
  ];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  await page.route("**/api/charger-reports/*/photos/*", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PHOTO_BUFFER })
  );
  await page.route("**/api/admin/charger-reports**", (route) => {
    const url = new URL(route.request().url());
    const action = url.pathname.match(/\/api\/admin\/charger-reports\/(\d+)\/(approve|reject)$/);
    if (action && route.request().method() === "POST") {
      const report = reports.find(({ id }) => id === Number(action[1]));
      report.status = action[2] === "approve" ? "approved" : "rejected";
      return route.fulfill({ json: { id: report.id, status: report.status } });
    }
    return route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });
  await fakePageData(page, CHARGER_REPORTS_PAGE, (url) => {
    const status = url.searchParams.get("status") ?? "pending";
    return {
      data: {
        reports: status === "all" ? reports : reports.filter((report) => report.status === status),
      },
    };
  });
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
  });

  test(
    "admin weighs a reported change by its proof and trust score, and approves it",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeReportsApi(page);
      await page.goto("/en/admin/");
      await page.getByRole("link", { name: "Reported changes" }).click();

      await expect(page.getByRole("heading", { level: 2, name: "Reported changes" })).toBeVisible();
      await expect(page.getByText("1 reported change")).toBeVisible();
      const report = page.getByRole("article").filter({ hasText: "Harbor Charging Hub" });
      await expect(report.getByText("Reported by ada@example.com")).toBeVisible();
      await expect(report.getByText("65/100")).toBeVisible();
      // The factors that counted, not the ones that gave nothing.
      await expect(
        report.getByRole("list", { name: "What the trust is based on" }).getByRole("listitem")
      ).toHaveText([
        "Location +30",
        "Charger photo +15",
        "Receipt photo +15",
        "Approved before +5",
      ]);
      await expect(report.getByText("Operational → Temporarily unavailable")).toBeVisible();
      await expect(report.getByText("€0.39/kWh → €0.45/kWh")).toBeVisible();
      await expect(report.getByText("The device was 30 m from the charger (±12 m)")).toBeVisible();
      await expect(report.getByRole("img", { name: "Charger photo" })).toBeVisible();
      await expect(
        report.getByRole("img", { name: "Receipt, invoice or charging app photo" })
      ).toBeVisible();
      await captureUi(page, testInfo, "admin reviewing a reported change");

      await report.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByText("No reported changes found.")).toBeVisible();

      await page
        .getByRole("group", { name: "Status" })
        .getByText("Approved", { exact: true })
        .click();
      await expect(report.getByRole("button", { name: "Approve" })).toBeHidden();
      await expect(report.getByText("Approved", { exact: true })).toBeVisible();
    }
  );

  test("says when the reports couldn't be loaded", async ({ page }) => {
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
    await fakePageData(page, CHARGER_REPORTS_PAGE, { failed: true });
    await page.goto("/en/admin/charger-reports/");

    await expect(page.getByText("The reports couldn't be loaded. Try again.")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });
});
