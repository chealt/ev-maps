import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/fixtures/auth-api.js";
import { fakeChargersApi } from "@ev-maps/e2e/fixtures/chargers-api.js";
import { fakeGoogleMaps } from "@ev-maps/e2e/fixtures/google.js";

const fakeErrorsApi = async (page) => {
  const reports = [];
  await page.route("**/api/errors", (route) => {
    reports.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { recorded: true } });
  });
  return reports;
};

test.beforeEach(async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
});

test("reports the page's uncaught errors and unhandled rejections, each once, but not extensions'", async ({
  page,
}) => {
  const reports = await fakeErrorsApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await page.evaluate(() => {
    const fail = () => {
      throw new TypeError("Cannot read the charger");
    };
    setTimeout(fail);
    setTimeout(fail);
    Promise.reject(new Error("The route failed"));
    const foreign = new Error("Extension broke");
    foreign.stack = "Error: Extension broke\n    at chrome-extension://abc/content.js:1:1";
    Promise.reject(foreign);
  });

  await expect.poll(() => reports.length).toBe(2);
  const uncaught = reports.find((report) => report.name === "TypeError");
  expect(uncaught).toMatchObject({
    message: "Cannot read the charger",
    url: "http://localhost:4322/en/",
  });
  expect(uncaught.stack).toContain("TypeError: Cannot read the charger");
  expect(reports.map((report) => report.message)).toContain("The route failed");
  expect(reports.map((report) => report.message)).not.toContain("Extension broke");
});
