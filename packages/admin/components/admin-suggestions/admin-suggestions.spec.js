import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { SUGGESTIONS_PAGE, fakePageData } from "@ev-maps/e2e/fixtures/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// The page is rendered on the server with the suggestions of its ?status=
// (pending by default; in the tests, passed in a header:
// src/lib/page-data.js); approving or rejecting one goes to the API.
const fakeSuggestionsApi = async (page) => {
  const suggestions = [
    {
      id: 1,
      userEmail: "ada@example.com",
      name: "Harbor Charging Hub",
      address: "10 Dock Rd",
      operator: "Ionity",
      location: { lat: 47.5, lng: 19.05 },
      connectors: [
        { type: "ccs2", powerKw: 350, quantity: 4 },
        { type: "type2", powerKw: 22, quantity: 2 },
      ],
      photoUrl: "/api/charger-suggestions/1/photo",
      photoUrls: [
        "/api/charger-suggestions/1/photo?index=0",
        "/api/charger-suggestions/1/photo?index=1",
      ],
      receiptPhotoUrls: ["/api/charger-suggestions/1/photo?index=2"],
      availability: "operational",
      price: { free: true },
      deviceLocation: null,
      distanceM: null,
      trustScore: 30,
      trustFactors: [
        { id: "location", points: 0 },
        { id: "chargerPhoto", points: 15 },
        { id: "receiptPhoto", points: 15 },
      ],
      status: "pending",
      createdAt: Date.UTC(2026, 10, 24, 12),
    },
  ];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  await page.route("**/api/charger-suggestions/*/photo", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: PHOTO_BUFFER,
    })
  );
  await page.route("**/api/admin/charger-suggestions**", (route) => {
    const url = new URL(route.request().url());
    const actionMatch = url.pathname.match(
      /\/api\/admin\/charger-suggestions\/(\d+)\/(approve|reject)$/
    );
    if (actionMatch && route.request().method() === "POST") {
      const id = Number(actionMatch[1]);
      const action = actionMatch[2];
      const item = suggestions.find((s) => s.id === id);
      if (item) {
        item.status = action === "approve" ? "approved" : "rejected";
      }
      return route.fulfill({ json: { id, status: item?.status } });
    }
    return route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });
  await fakePageData(page, SUGGESTIONS_PAGE, (url) => {
    const status = url.searchParams.get("status") ?? "pending";
    const shown = status === "all" ? suggestions : suggestions.filter((s) => s.status === status);
    return { data: { suggestions: shown } };
  });
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
  });

  test(
    "admin reviews suggested chargers and approves one to add it to the database",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      await fakeSuggestionsApi(page);
      await page.goto("/en/admin/suggestions/");

      await expect(
        page.getByRole("heading", { level: 2, name: "Suggested chargers" })
      ).toBeVisible();
      await expect(page.getByText("1 charger suggestion")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 3, name: "Harbor Charging Hub" })
      ).toBeVisible();
      await expect(page.getByText("Ionity · 10 Dock Rd")).toBeVisible();
      await expect(page.getByText("CCS (Type 2): 4× · 350 kW")).toBeVisible();
      await expect(page.getByText("Type 2: 2× · 22 kW")).toBeVisible();
      await expect(page.getByRole("img", { name: "Charger proof photo" })).toHaveCount(2);
      // What it says about the availability and price, and how far to trust it.
      await expect(
        page.getByRole("img", { name: "Receipt, invoice or charging app photo" })
      ).toBeVisible();
      await expect(page.getByText("30/100")).toBeVisible();
      await expect(page.getByText("Operational", { exact: true })).toBeVisible();
      await expect(page.getByText("Free", { exact: true })).toBeVisible();
      await expect(page.getByText("The device's location wasn't shared")).toBeVisible();
      await captureUi(page, testInfo, "admin reviewing a charger suggestion");

      await page.getByRole("button", { name: "Approve & add" }).click();

      await expect(page.getByText("No charger suggestions found.")).toBeVisible();

      await page
        .getByRole("group", { name: "Status" })
        .getByText("Approved", { exact: true })
        .click();
      await expect(
        page.getByRole("heading", { level: 3, name: "Harbor Charging Hub" })
      ).toBeVisible();
      await captureUi(page, testInfo, "admin viewing approved charger suggestions");
    }
  );

  test("says when the suggestions couldn't be loaded", async ({ page }) => {
    await page.route("**/api/admin/me", (route) =>
      route.fulfill({ json: { admin: true, email: GRACE.email } })
    );
    await fakePageData(page, SUGGESTIONS_PAGE, { failed: true });
    await page.goto("/en/admin/suggestions/");

    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "couldn't be loaded" })).toBeVisible();
  });
});
