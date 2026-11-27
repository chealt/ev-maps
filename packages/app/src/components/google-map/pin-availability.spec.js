import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi, fakeStatusApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

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

test.describe("map", () => {
  test.beforeEach(async ({ page }) => {
    await fakeGoogleMaps(page);
    await fakeChargersApi(page, { chargers });
  });

  // A pin with no point free says so in its name, which is what screen
  // readers hear; its red is in the UI evidence.
  const noneFree = (page, name) =>
    page
      .getByRole("region", { name: "EV charging station map" })
      .getByRole("button", { name: `${name}, no points free` });

  test("marks the pins where no point is free, signed in, and not signed out", async ({ page }) => {
    await fakeAuthApi(page);
    const requests = await fakeStatusApi(page, statuses);
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
    await expect(noneFree(page, "Full station")).toHaveCount(0);
    expect(requests).toHaveLength(0);

    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await expect(noneFree(page, "Full station")).toBeVisible();
    await expect(noneFree(page, "Broken station")).toBeVisible();
    await expect(noneFree(page, "Free station")).toHaveCount(0);
    await expect(noneFree(page, "Station without statuses")).toHaveCount(0);
    // One request for every pin with live statuses, none for the others.
    expect(requests[0].toSorted()).toEqual(["eipa:1", "eipa:3", "irve:FR2"]);

    await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(noneFree(page, "Full station")).toHaveCount(0);
  });

  test.describe("with the service worker", () => {
    // Every other test blocks service workers (see playwright.config.js).
    test.use({ serviceWorkers: "allow" });

    test("shares the statuses between tabs: two tabs make one request", async ({ page }) => {
      await fakeAuthApi(page, { signedIn: true });
      const requests = await fakeStatusApi(page, statuses);
      await page.goto("/");
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      await page.reload();
      await expect(noneFree(page, "Full station")).toBeVisible();
      const afterFirstTab = requests.length;

      // A second tab of the same browser, controlled by the same worker.
      const second = await page.context().newPage();
      await fakeGoogleMaps(second);
      await fakeAuthApi(second, { signedIn: true });
      await second.goto("/");
      await expect(noneFree(second, "Full station")).toBeVisible();
      await expect(noneFree(second, "Free station")).toHaveCount(0);

      // Its statuses came from the worker's shared cache, not the Worker.
      expect(requests).toHaveLength(afterFirstTab);
    });
  });

  test(
    "hides the chargers with no point free with the filter, once signed in",
    { tag: "@ui" },
    async ({ page }) => {
      await fakeAuthApi(page);
      await fakeStatusApi(page, statuses);
      await page.goto("/");
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      const filters = page.getByRole("dialog", { name: "Filters" });
      const hide = filters.getByRole("button", { name: "Hide unavailable" });
      await expect(hide).toHaveAttribute("aria-disabled", "true");
      await expect(hide).toHaveAccessibleDescription(
        "Sign in to see how many points are free right now. Hides the chargers whose live availability says none of their points is free."
      );
      await filters.getByRole("button", { name: "Done" }).click();

      await page.getByRole("button", { name: "Sign in" }).click();
      await page.getByRole("button", { name: "Sign in with Google" }).click();
      await expect(noneFree(page, "Full station")).toBeVisible();
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await hide.click();
      await filters.getByRole("button", { name: "Done" }).click();

      // The full and the broken one go; one without statuses stays, as nothing
      // says it's taken.
      await expect(page.getByRole("status")).toHaveText("2 of 4 EV chargers match the filters");
      const map = page.getByRole("region", { name: "EV charging station map" });
      await expect(map.getByRole("button", { name: /Full station/ })).toBeHidden();
      await expect(map.getByRole("button", { name: /Broken station/ })).toBeHidden();
      await expect(map.getByRole("button", { name: "Free station" })).toBeVisible();
      await expect(map.getByRole("button", { name: "Station without statuses" })).toBeVisible();
    }
  );
});
