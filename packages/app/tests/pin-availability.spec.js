import { expect, test } from "./fixtures/test.js";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi, fakeStatusApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, name, [lat, lng]) => ({
  id,
  source: id.split(":")[0],
  ids: [id],
  name,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 2 }],
});

const chargers = [
  charger("eipa:1", "Full station", [40.71, -74.0]),
  charger("irve:FR2", "Free station", [40.75, -73.95]),
  charger("eipa:3", "Broken station", [40.79, -74.02]),
  charger("ocm:4", "Station without statuses", [40.68, -74.05]),
];

const status = (available, occupied, outOfService) => ({
  available,
  occupied,
  outOfService,
  total: available + occupied + outOfService,
  updatedAt: Date.now(),
});

const statuses = {
  "eipa:1": status(0, 2, 0),
  "irve:FR2": status(1, 1, 0),
  "eipa:3": status(0, 1, 1),
};

const pin = (page, name) =>
  page
    .getByRole("region", { name: "EV charging station map" })
    .getByRole("button", { name })
    .locator(".charger-marker");

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeChargersApi(page, { chargers });
});

test("makes the pins red where none of the points is free", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  const requests = await fakeStatusApi(page, statuses);
  await page.goto("/");

  await expect(pin(page, "Full station")).toHaveClass(/none-free/);
  await expect(pin(page, "Broken station")).toHaveClass(/none-free/);
  await expect(pin(page, "Free station")).not.toHaveClass(/none-free/);
  await expect(pin(page, "Station without statuses")).not.toHaveClass(/none-free/);
  // Screen readers hear it in the pin's name.
  await expect(page.getByRole("button", { name: "Full station, no points free" })).toBeVisible();
  // One request for every pin with live statuses, none for the others.
  expect(requests[0].toSorted()).toEqual(["eipa:1", "eipa:3", "irve:FR2"]);
});

test("keeps the pins as usual when signed out, without asking for statuses", async ({ page }) => {
  await fakeAuthApi(page);
  const requests = await fakeStatusApi(page, statuses);
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  await expect(pin(page, "Full station")).not.toHaveClass(/none-free/);
  expect(requests).toHaveLength(0);
});

test("makes the pins red after signing in, and as usual after signing out", async ({ page }) => {
  await fakeAuthApi(page);
  await fakeStatusApi(page, statuses);
  await page.goto("/");
  await expect(pin(page, "Full station")).not.toHaveClass(/none-free/);

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(pin(page, "Full station")).toHaveClass(/none-free/);

  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(pin(page, "Full station")).not.toHaveClass(/none-free/);
});
