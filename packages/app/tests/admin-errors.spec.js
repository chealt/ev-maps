import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "@ev-maps/e2e/auth-api.js";
import { ERRORS_PAGE, fakePageData } from "@ev-maps/e2e/page-data.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const minutesAgo = (minutes) => Date.now() - minutes * 60 * 1000;

const group = (index) => ({
  fingerprint: index.toString(16).padStart(8, "0"),
  source: index % 2 ? "worker" : "page",
  name: "TypeError",
  message: `Error number ${index}`,
  url: "https://ev.chealt.com/en/",
  context: null,
  count: index + 1,
  users: 1,
  first_seen: minutesAgo(600),
  last_seen: minutesAgo(index + 1),
});

// The page is rendered on the server with the errors the Worker gives it
// (packages/worker/src/admin.js); in development, the tests pass them in a
// header (src/lib/page-data.js). `groupCount` groups, 25 a page.
const fakeErrorsData = async (page, groupCount) => {
  const groups = Array.from({ length: groupCount }, (_, index) => group(index));
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  const dataFor = (url) => {
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    const fingerprint = url.searchParams.get("error");
    if (fingerprint) {
      return {
        fingerprint,
        page: 1,
        pages: 1,
        total: 2,
        occurrences: [
          {
            id: 2,
            source: "page",
            name: "TypeError",
            message: "Error number 0",
            stack: "TypeError: Error number 0\n    at show (GoogleMap.js:10:5)",
            url: "https://ev.chealt.com/hu/hu/",
            method: null,
            context: null,
            user_agent: "Mozilla/5.0 Firefox/140.0",
            user_id: "user-1",
            country: "HU",
            created_at: minutesAgo(1),
          },
          {
            id: 1,
            source: "page",
            name: "TypeError",
            message: "Error number 0",
            stack: null,
            url: "https://ev.chealt.com/en/",
            method: null,
            context: null,
            user_agent: "Chrome",
            user_id: null,
            country: null,
            created_at: minutesAgo(30),
          },
        ],
      };
    }
    return {
      groups: groups.slice((pageNumber - 1) * 25, pageNumber * 25),
      page: pageNumber,
      pages: Math.max(1, Math.ceil(groupCount / 25)),
      total: groupCount,
    };
  };
  await fakePageData(page, ERRORS_PAGE, (url) => ({ data: dataFor(url) }));
};

test.beforeEach(async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true, user: GRACE });
});

test("lists the errors grouped, the latest first", { tag: "@performance" }, async ({ page }) => {
  await fakeErrorsData(page, 3);
  await page.goto("/en/admin/errors/");

  await expect(page.getByRole("heading", { level: 2, name: "Errors" })).toBeVisible();
  await expect(page.getByText("3 kinds of errors in the last 30 days")).toBeVisible();
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText("TypeError: Error number 0");
  await expect(rows.nth(1)).toContainText("Browser");
  await expect(rows.nth(1)).toContainText("1 minute ago");
  await expect(rows.nth(2)).toContainText("Server");
  await expect(page.getByRole("navigation", { name: "Pages" })).toBeHidden();
});

test("pages through many errors", async ({ page }) => {
  await fakeErrorsData(page, 30);
  await page.goto("/en/admin/errors/");
  const pager = page.getByRole("navigation", { name: "Pages" }).first();

  await expect(pager.getByText("Page 1 of 2")).toBeVisible();
  await expect(pager.getByRole("link", { name: "Previous" })).toHaveCount(0);
  await pager.getByRole("link", { name: "Next" }).click();

  await expect(page).toHaveURL("/en/admin/errors/?page=2");
  await expect(pager.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(6);
  await page.goBack();
  await expect(pager.getByText("Page 1 of 2")).toBeVisible();
});

test("renders the errors on the server, with no script", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await fakeErrorsData(page, 3);
  await page.goto("/en/admin/errors/");

  await expect(page.getByText("3 kinds of errors in the last 30 days")).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  await page.getByRole("link", { name: "TypeError: Error number 0" }).click();
  await expect(page.getByText("Happened 2 times in the last 30 days")).toBeVisible();
  await context.close();
});

test("says when the errors couldn't be read", async ({ page }) => {
  await fakePageData(page, ERRORS_PAGE, { failed: true });
  await page.goto("/en/admin/errors/");

  await expect(page.getByRole("alert")).toHaveText("The errors couldn't be loaded. Try again.");
});

test("shows an error's occurrences with their details", async ({ page }) => {
  await fakeErrorsData(page, 3);
  await page.goto("/en/admin/errors/");

  await page.getByRole("link", { name: "TypeError: Error number 0" }).click();

  await expect(page).toHaveURL("/en/admin/errors/?error=00000000");
  await expect(
    page.getByRole("heading", { level: 2, name: "TypeError: Error number 0" })
  ).toBeVisible();
  await expect(page.getByText("Happened 2 times in the last 30 days")).toBeVisible();
  const [first] = await page.getByRole("listitem").filter({ hasText: "Firefox" }).all();
  await expect(first).toContainText("https://ev.chealt.com/hu/hu/");
  await expect(first).toContainText("user-1");
  await expect(first).toContainText("HU");
  await first.getByText("Stack trace").click();
  await expect(first.getByText("at show (GoogleMap.js:10:5)")).toBeVisible();

  await page.getByRole("link", { name: "All errors" }).click();
  await expect(page).toHaveURL("/en/admin/errors/");
  await expect(page.getByText("3 kinds of errors in the last 30 days")).toBeVisible();
});

test("says when there are no errors", async ({ page }) => {
  await fakeErrorsData(page, 0);
  await page.goto("/en/admin/errors/");

  await expect(page.getByText("No errors in the last 30 days.")).toBeVisible();
});

test("links the overview to the errors", async ({ page }) => {
  await fakeErrorsData(page, 0);
  await page.goto("/en/admin/");

  await page.locator(".admin-section").getByRole("link", { name: "Errors" }).click();

  await expect(page).toHaveURL("/en/admin/errors/");
  await expect(page.getByRole("link", { name: "Errors" }).first()).toHaveAttribute(
    "aria-current",
    "page"
  );
});
