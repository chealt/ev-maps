import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";
import { fakeSettingsApi } from "@ev-maps/e2e/fixtures/settings-api.js";

// Far enough apart that they aren't clustered at the default zoom.
const charger = (id, name, [lat, lng], operator) => ({
  id: `ocm:${id}`,
  source: "ocm",
  name,
  operator,
  location: { lat, lng },
  address: "",
  maxPowerKw: 50,
  connectors: [{ type: "ccs2", powerKw: 50, quantity: 1 }],
});

const chargers = [
  charger(1, "Ionity North", [40.71, -74.0], "Ionity"),
  charger(2, "Ionity South", [40.75, -73.95], "Ionity"),
  charger(3, "Tesla Mall", [40.79, -74.02], "Tesla"),
  charger(4, "Mystery post", [40.68, -74.05], undefined),
];

const openFilters = async (page) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  return page.getByRole("dialog", { name: "Filters" });
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page, { chargers });
});

test("lists the operators on the map, all ticked, most chargers first", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  const dialog = await openFilters(page);
  const operators = dialog.getByRole("group", { name: "Operator" });

  await expect(operators.getByRole("checkbox")).toHaveCount(3);
  await expect(operators.locator(".operator-name")).toHaveText([
    "Ionity",
    "Tesla",
    "Unknown operator",
  ]);
  await expect(operators.locator(".operator-count")).toHaveText(["2", "1", "1"]);
  for (const name of ["Ionity", "Tesla", "Unknown operator"]) {
    await expect(operators.getByRole("checkbox", { name })).toBeChecked();
  }
  await expect(operators.getByRole("button", { name: "Show all" })).toBeHidden();
});

test("hides the chargers of the operators turned off", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFilters(page);
  const operators = dialog.getByRole("group", { name: "Operator" });

  await operators.getByRole("checkbox", { name: "Ionity" }).uncheck();
  await operators.getByRole("checkbox", { name: "Unknown operator" }).uncheck();

  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  // The operator filter counts once on the Filters button.
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("1 filter on");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "Tesla Mall" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Ionity North" })).toBeHidden();
});

test("shows every operator again with Show all, or Clear filters", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFilters(page);
  const operators = dialog.getByRole("group", { name: "Operator" });

  await operators.getByRole("checkbox", { name: "Tesla" }).uncheck();
  await operators.getByRole("button", { name: "Show all" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeChecked();
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");

  await operators.getByRole("checkbox", { name: "Tesla" }).uncheck();
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeChecked();
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
});

test("keeps the operators turned off after a reload, and saves them to the account", async ({
  page,
}) => {
  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  let dialog = await openFilters(page);
  await dialog.getByRole("checkbox", { name: "Tesla" }).uncheck();
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].filters.excludedOperators).toEqual(["Tesla"]);

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("3 of 4 EV chargers match the filters");
  dialog = await openFilters(page);
  await expect(dialog.getByRole("checkbox", { name: "Tesla" })).not.toBeChecked();
});

test("keeps an operator that's turned off listed when it's not on the map", async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page, {
    filters: { excludedOperators: ["Shell Recharge"], updatedAt: Date.now() },
  });
  await page.goto("/");

  const dialog = await openFilters(page);
  const shell = dialog.getByRole("checkbox", { name: "Shell Recharge" });
  await expect(shell).not.toBeChecked();
  const option = dialog
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: "Shell Recharge" }) });
  await expect(option.locator(".operator-count")).toHaveText("0");

  await shell.check();
  await expect(dialog.getByRole("button", { name: "Show all" })).toBeHidden();
});

test("can't pick the operators the other filters leave no chargers of", async ({ page }) => {
  // Tesla's only charger here has no CCS connector.
  await fakeChargersApi(page, {
    chargers: [
      ...chargers.filter((item) => item.operator !== "Tesla"),
      {
        ...charger(3, "Tesla Mall", [40.79, -74.02], "Tesla"),
        connectors: [{ type: "chademo", powerKw: 50, quantity: 1 }],
      },
    ],
  });
  await page.goto("/");
  const dialog = await openFilters(page);
  const operators = dialog.getByRole("group", { name: "Operator" });
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeEnabled();

  await dialog.getByRole("button", { name: "CCS" }).click();

  // Still listed, so the list doesn't jump, but with none left to show.
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeDisabled();
  await expect(operators.locator(".operator-count")).toHaveText(["2", "1", "0"]);
  await expect(operators.getByRole("checkbox", { name: "Ionity" })).toBeEnabled();

  // Back as it was once the filter is off, and after the dialog closes.
  await dialog.getByRole("button", { name: "CCS" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeEnabled();
  await dialog.getByRole("button", { name: "CCS" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await openFilters(page);
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeDisabled();
});
