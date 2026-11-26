import { captureUi, expect, test } from "@ev-maps/e2e/test.js";
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

test(
  "the operator in a charger's details lists the operator's chargers",
  { tag: "@ui" },
  async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
    const map = page.getByRole("region", { name: "EV charging station map" });
    await map.getByRole("button", { name: "Ionity North" }).click();
    const details = page.getByRole("complementary", { name: "Ionity North" });
    await expect(details.getByText("Operator: Ionity")).toBeVisible();

    await details.getByRole("button", { name: "Show the chargers by Ionity" }).click();
    const list = page.getByRole("dialog", { name: "2 EV chargers by Ionity" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("button", { name: /Ionity North/ })).toBeVisible();
    await captureUi(page, testInfo, "an operator's chargers");

    // One of them opens its details.
    await list.getByRole("button", { name: /Ionity South/ }).click();
    await expect(list).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Ionity South" })).toBeVisible();
  }
);

// Which chargers an operator turned off hides is unit tested in
// charger-index.test.js.
test("lists the operators, hides those turned off, shows them again, and keeps them in the account", async ({
  page,
}) => {
  await fakeAuthApi(page, { signedIn: true });
  const saves = await fakeSettingsApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");
  let dialog = await openFilters(page);
  const operators = dialog.getByRole("group", { name: "Operator" });

  // All of them, ticked, most chargers first.
  await expect(operators.locator(".operator-name")).toHaveText([
    "Ionity",
    "Tesla",
    "Unknown operator",
  ]);
  await expect(operators.locator(".operator-count")).toHaveText(["2", "1", "1"]);
  await expect(operators.getByRole("checkbox", { checked: false })).toHaveCount(0);
  await expect(operators.getByRole("button", { name: "Show all" })).toBeHidden();

  // Show all, or Clear filters, ticks them again.
  await operators.getByRole("checkbox", { name: "Tesla" }).uncheck();
  await operators.getByRole("button", { name: "Show all" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeChecked();
  await operators.getByRole("checkbox", { name: "Tesla" }).uncheck();
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeChecked();
  await expect(page.getByRole("status")).toHaveText("4 EV chargers found");

  await operators.getByRole("checkbox", { name: "Ionity" }).uncheck();
  await operators.getByRole("checkbox", { name: "Unknown operator" }).uncheck();
  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  await dialog.getByRole("button", { name: "Done" }).click();
  // The operator filter counts once.
  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toHaveAccessibleDescription("1 filter on");
  const map = page.getByRole("region", { name: "EV charging station map" });
  await expect(map.getByRole("button", { name: "Tesla Mall" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Ionity North" })).toBeHidden();

  await expect
    .poll(() => [...(saves.at(-1)?.filters.excludedOperators ?? [])].sort())
    .toEqual(["", "Ionity"]);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("1 of 4 EV chargers match the filters");
  dialog = await openFilters(page);
  await expect(dialog.getByRole("checkbox", { name: "Ionity" })).not.toBeChecked();
});

test("keeps listed the operators turned off elsewhere, and those the other filters leave none of", async ({
  page,
}) => {
  await fakeAuthApi(page, { signedIn: true });
  await fakeSettingsApi(page, {
    filters: { excludedOperators: ["Shell Recharge"], updatedAt: Date.now() },
  });
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

  // Turned off on another device, though not on this map: listed, to turn
  // back on.
  const shell = operators.getByRole("checkbox", { name: "Shell Recharge" });
  await expect(shell).not.toBeChecked();
  await shell.check();
  await expect(operators.getByRole("button", { name: "Show all" })).toBeHidden();

  // None left by the other filters: still listed, so the list doesn't jump,
  // but not to pick.
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeEnabled();
  await dialog.getByRole("button", { name: "CCS" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeDisabled();
  await expect(operators.getByRole("checkbox", { name: "Ionity" })).toBeEnabled();
  await dialog.getByRole("button", { name: "CCS" }).click();
  await expect(operators.getByRole("checkbox", { name: "Tesla" })).toBeEnabled();
});
