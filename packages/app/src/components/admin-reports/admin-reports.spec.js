import { expect, test } from "@ev-maps/e2e/test.js";
import { fakeAuthApi } from "#fixtures/auth-api.js";

const GRACE = { id: "user-2", name: "Grace Hopper", email: "grace@chealt.com", image: null };
const RUN = "https://github.com/chealt/ev-maps/actions/runs";

const report = (index, overrides = {}) => ({
  id: `${9000 + index}-1`,
  branch: "feat/test-reports",
  commit_sha: "0123456789abcdef0123456789abcdef01234567",
  pull_request: 91,
  run_url: `${RUN}/${9000 + index}`,
  status: "passed",
  passed: 158,
  failed: 0,
  flaky: 1,
  skipped: 0,
  duration_ms: 84000,
  created_at: Date.UTC(2026, 10, 24, 12) - index * 3600000,
  ...overrides,
});

// The Worker's list of reports, `total` of them (the first on main, the rest
// on a feature branch), 20 a page, filtered by ?branch=; the requests are
// returned.
const fakeReportsApi = async (page, total) => {
  const reports = Array.from({ length: total }, (_, index) =>
    report(
      index,
      index === 0
        ? { status: "failed", failed: 2, passed: 156, pull_request: null, branch: "main" }
        : {}
    )
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: { admin: true, email: GRACE.email } })
  );
  const requests = [];
  await page.route("**/api/admin/test-reports?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    const pageNumber = Number(params.get("page"));
    const branch = params.get("branch");
    const shown = branch ? reports.filter((item) => item.branch === branch) : reports;
    return route.fulfill({
      json: {
        reports: shown.slice((pageNumber - 1) * 20, pageNumber * 20),
        branch,
        branches: [...new Set(reports.map((item) => item.branch))],
        page: pageNumber,
        pages: Math.max(1, Math.ceil(shown.length / 20)),
        total: shown.length,
      },
    });
  });
  return requests;
};

const branchFilter = (page) => page.getByRole("combobox", { name: "Branch" });

test.beforeEach(async ({ page }) => {
  await fakeAuthApi(page, { signedIn: true, user: GRACE });
});

test(
  "lists the reports, the latest first, with links to them",
  { tag: "@performance" },
  async ({ page }) => {
    await fakeReportsApi(page, 2);
    await page.goto("/en/admin/reports/");
    await branchFilter(page).selectOption({ label: "All branches" });

    await expect(page.getByRole("heading", { level: 2, name: "Test reports" })).toBeVisible();
    await expect(page.getByText("2 reports in the last 30 days")).toBeVisible();
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(3);

    const latest = rows.nth(1);
    await expect(latest).toContainText("Failed");
    await expect(latest).toContainText("156 passed, 2 failed, 1 flaky");
    await expect(latest).toContainText("main");
    await expect(latest).toContainText("1.4 min");
    await expect(latest.getByRole("link", { name: "0123456" })).toHaveAttribute(
      "href",
      "https://github.com/chealt/ev-maps/commit/0123456789abcdef0123456789abcdef01234567"
    );
    await expect(latest.getByRole("link", { name: "Open report" })).toHaveAttribute(
      "href",
      "/en/admin/reports/9000-1/"
    );

    const older = rows.nth(2);
    await expect(older).toContainText("Passed");
    await expect(older.getByRole("link", { name: "#91" })).toHaveAttribute(
      "href",
      "https://github.com/chealt/ev-maps/pull/91"
    );
    await expect(page.getByRole("navigation", { name: "Pages" })).toBeHidden();
  }
);

test("pages through many reports", async ({ page }) => {
  await fakeReportsApi(page, 25);
  await page.goto("/en/admin/reports/");
  await branchFilter(page).selectOption("feat/test-reports");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();

  await expect(page).toHaveURL("/en/admin/reports/?page=2");
  // The 24 on the feature branch: 4 on the second page.
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(5);
});

test("is in the admin navigation", async ({ page }) => {
  await fakeReportsApi(page, 0);
  await page.goto("/en/admin/");

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Test reports" })
    .click();

  await expect(page).toHaveURL("/en/admin/reports/");
  await expect(page.getByText("No reports in the last 30 days.")).toBeVisible();
});

test("shows the default branch's reports first, and remembers the filter", async ({ page }) => {
  const requests = await fakeReportsApi(page, 3);
  await page.goto("/en/admin/reports/");

  await expect(branchFilter(page)).toHaveValue("main");
  await expect(page.getByText("1 report in the last 30 days")).toBeVisible();
  expect(requests[0]).toEqual({ page: "1", branch: "main" });
  await expect(branchFilter(page).getByRole("option")).toHaveText([
    "All branches",
    "main",
    "feat/test-reports",
  ]);

  await branchFilter(page).selectOption("feat/test-reports");
  await expect(page.getByText("2 reports in the last 30 days")).toBeVisible();

  // Kept in this browser (IndexedDB).
  await page.reload();
  await expect(branchFilter(page)).toHaveValue("feat/test-reports");
  await expect(page.getByText("2 reports in the last 30 days")).toBeVisible();
  expect(requests.at(-1)).toEqual({ page: "1", branch: "feat/test-reports" });

  await branchFilter(page).selectOption({ label: "All branches" });
  await expect(page.getByText("3 reports in the last 30 days")).toBeVisible();
  expect(requests.at(-1)).toEqual({ page: "1" });
});
