import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
      photo: PHOTO,
      status: "pending",
      createdAt: Date.UTC(2026, 10, 24, 12),
    },
  ];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
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
    const status = url.searchParams.get("status");
    const shown = status ? suggestions.filter((s) => s.status === status) : suggestions;
    return route.fulfill({ json: { suggestions: shown } });
  });
};

test.beforeEach(async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true, user: GRACE });
});

test(
  "admin reviews suggested chargers and approves one to add it to the database",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await fakeSuggestionsApi(page);
    await page.goto("/en/admin/suggestions/");

    await expect(page.getByRole("heading", { level: 2, name: "Suggested chargers" })).toBeVisible();
    await expect(page.getByText("1 charger suggestion")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Harbor Charging Hub" })
    ).toBeVisible();
    await expect(page.getByText("Ionity · 10 Dock Rd")).toBeVisible();
    await expect(page.getByText("CCS (Type 2): 4× · 350 kW")).toBeVisible();
    await expect(page.getByText("Type 2: 2× · 22 kW")).toBeVisible();
    await expect(page.getByRole("img", { name: "Charger proof photo" })).toBeVisible();
    await captureUi(page, testInfo, "admin reviewing a charger suggestion");

    await page.getByRole("button", { name: "Approve & add" }).click();

    await expect(page.getByText("No charger suggestions found.")).toBeVisible();

    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Approved" });
    await expect(
      page.getByRole("heading", { level: 3, name: "Harbor Charging Hub" })
    ).toBeVisible();
  }
);
