import { expect, test } from "@playwright/test";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

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

test("reports the page's uncaught errors, each once", async ({ page }) => {
  const reports = await fakeErrorsApi(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("2 EV chargers found");

  await page.evaluate(() => {
    const fail = () => {
      throw new TypeError("Cannot read the charger");
    };
    setTimeout(fail);
    setTimeout(fail);
  });

  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0]).toMatchObject({
    name: "TypeError",
    message: "Cannot read the charger",
    url: "http://localhost:4322/en/",
  });
  expect(reports[0].stack).toContain("TypeError: Cannot read the charger");
});

test("reports rejected promises nobody handled", async ({ page }) => {
  const reports = await fakeErrorsApi(page);
  await page.goto("/");

  await page.evaluate(() => {
    Promise.reject(new Error("The route failed"));
  });

  await expect.poll(() => reports.map((report) => report.message)).toContain("The route failed");
});

test("ignores errors from browser extensions", async ({ page }) => {
  const reports = await fakeErrorsApi(page);
  await page.goto("/");

  await page.evaluate(() => {
    const error = new Error("Extension broke");
    error.stack = "Error: Extension broke\n    at chrome-extension://abc/content.js:1:1";
    Promise.reject(error);
    setTimeout(() => {
      throw new Error("The page's own");
    });
  });

  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0].message).toBe("The page's own");
});
