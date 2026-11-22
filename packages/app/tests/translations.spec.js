import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

// Each kind of page only gets the messages of its sections (src/i18n),
// baked into its HTML at build time, so
// a script asking for another section's message would show nothing; it logs
// "Missing message" instead (src/lib/messages.js).
const watchMissingMessages = (page) => {
  const missing = [];
  page.on("console", (entry) => {
    if (entry.text().includes("Missing message")) {
      missing.push(entry.text());
    }
  });
  return missing;
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page);
});

test("the map pages have every message their scripts use", async ({ page }) => {
  const missing = watchMissingMessages(page);
  await fakeAuthApi(page, { signedIn: true });
  await page.route("**/api/favorites", (route) => route.fulfill({ json: { favorites: [] } }));
  await page.goto("/hu/");
  await expect(page.getByRole("status")).toHaveText("2 töltőállomás található");

  await page
    .getByRole("region", { name: "Töltőállomások térképe" })
    .getByRole("button", { name: "Downtown Supercharger" })
    .click();
  await page.getByRole("button", { name: "Szűrők", exact: true }).click();
  await page.getByRole("dialog", { name: "Szűrők" }).getByRole("button", { name: "CCS" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Fiók: / }).click();
  await page.getByRole("button", { name: "Kedvencek" }).click();
  await expect(page.getByRole("dialog", { name: "Kedvencek" })).toBeVisible();

  expect(missing).toEqual([]);
});

test("the legal pages get no messages, and the admin pages only their own", async ({ page }) => {
  const missing = watchMissingMessages(page);
  await fakeAuthApi(page, { signedIn: true });
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: "grace@chealt.com" } })
  );
  await page.route("**/api/admin/errors?**", (route) =>
    route.fulfill({ json: { groups: [], page: 1, pages: 1, total: 0 } })
  );

  await page.goto("/pl/privacy/");
  // Their scripts show no copy, so they carry none.
  await expect(page.locator("#messages")).toHaveCount(0);

  await page.goto("/pl/admin/errors/");
  await expect(page.getByText("Brak błędów w ostatnich 30 dniach.")).toBeVisible();
  const adminMessages = await page.evaluate(
    () => JSON.parse(document.getElementById("messages").textContent).messages
  );
  expect(adminMessages).toHaveProperty("adminNoErrors");
  expect(adminMessages).not.toHaveProperty("chargerCount");

  expect(missing).toEqual([]);
});
