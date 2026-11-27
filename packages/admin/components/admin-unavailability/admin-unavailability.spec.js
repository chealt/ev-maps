import { Buffer } from "node:buffer";
import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const PHOTO_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// As the Worker lists them: most reporters first, then most photos.
const fakeUnavailabilityApi = async (page) => {
  let chargers = [
    {
      chargerId: "ocm:42",
      chargerName: "Harbor Charging Hub",
      currentStatus: "operational",
      reporters: 2,
      withPhoto: 1,
      lastReportedAt: Date.UTC(2026, 10, 25, 12),
      flags: [
        {
          id: 2,
          userEmail: "ada@example.com",
          createdAt: Date.UTC(2026, 10, 25, 12),
          photoUrl: "/api/charger-unavailability/2/photo",
        },
        {
          id: 1,
          userEmail: "alan@example.com",
          createdAt: Date.UTC(2026, 10, 24, 9),
          photoUrl: null,
        },
      ],
    },
    {
      chargerId: "ocm:7",
      chargerName: "Market Square",
      currentStatus: null,
      reporters: 1,
      withPhoto: 0,
      lastReportedAt: Date.UTC(2026, 10, 26, 8),
      flags: [
        {
          id: 3,
          userEmail: "ada@example.com",
          createdAt: Date.UTC(2026, 10, 26, 8),
          photoUrl: null,
        },
      ],
    },
  ];
  const actions = [];
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  await page.route("**/api/charger-unavailability/*/photo", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PHOTO_BUFFER })
  );
  await page.route("**/api/admin/charger-unavailability**", (route) => {
    const action = new URL(route.request().url()).pathname.match(
      /\/api\/admin\/charger-unavailability\/([^/]+)\/(confirm|dismiss)$/
    );
    if (action && route.request().method() === "POST") {
      const chargerId = decodeURIComponent(action[1]);
      actions.push({ chargerId, action: action[2] });
      chargers = chargers.filter((charger) => charger.chargerId !== chargerId);
      return route.fulfill({ json: { chargerId, status: action[2] } });
    }
    return route.fulfill({ json: { chargers } });
  });
  return actions;
};

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await fakeAuthApi(page, { signedIn: true, user: GRACE });
  });

  test(
    "admin sees the chargers reported unavailable, most reported first, and acts on them",
    { tag: "@ui" },
    async ({ page }, testInfo) => {
      const actions = await fakeUnavailabilityApi(page);
      await page.goto("/en/admin/");
      await page.getByRole("link", { name: "Unavailable chargers" }).click();

      await expect(
        page.getByRole("heading", { level: 2, name: "Unavailable chargers" })
      ).toBeVisible();
      await expect(page.getByText("2 chargers reported unavailable")).toBeVisible();
      await expect(page.getByRole("article").getByRole("heading", { level: 3 })).toHaveText([
        "Harbor Charging Hub",
        "Market Square",
      ]);
      const harbor = page.getByRole("article").filter({ hasText: "Harbor Charging Hub" });
      await expect(harbor.getByText("2 people · 1 photo")).toBeVisible();
      await expect(harbor.getByText("Now: Operational")).toBeVisible();
      await expect(harbor.getByText(/Reported by ada@example\.com/)).toBeVisible();
      await expect(harbor.getByText(/Reported by alan@example\.com/)).toBeVisible();
      await expect(harbor.getByRole("img", { name: "Charger photo" })).toHaveCount(1);
      await captureUi(page, testInfo, "admin reviewing unavailable chargers");

      await harbor.getByRole("button", { name: "Mark unavailable" }).click();
      await expect(page.getByText("1 charger reported unavailable")).toBeVisible();
      await page
        .getByRole("article")
        .filter({ hasText: "Market Square" })
        .getByRole("button", { name: "Dismiss" })
        .click();
      await expect(page.getByText("No chargers reported unavailable.")).toBeVisible();
      expect(actions).toEqual([
        { chargerId: "ocm:42", action: "confirm" },
        { chargerId: "ocm:7", action: "dismiss" },
      ]);
    }
  );
});
