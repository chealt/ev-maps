import { get, set } from "idb-keyval";
import { formatNumber, message } from "../../lib/messages.js";

const REPORTS_URL = "/api/admin/test-reports";
// The branch filter, remembered in this browser (IndexedDB); the default
// branch until one is picked ("" is every branch).
const BRANCH_KEY = "ev-maps:admin-reports-branch";
const DEFAULT_BRANCH = "main";

const language = () => document.documentElement.lang || "en";

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(language(), { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(timestamp)
  );

const formatMinutes = (ms) =>
  message("adminMinutes", { value: formatNumber(ms / 60000, { maximumFractionDigits: 1 }) });

const pageOf = () =>
  Math.max(1, Number.parseInt(new URL(window.location.href).searchParams.get("page"), 10) || 1);

// The repository's address, from the run's (…/owner/repo/actions/runs/…).
const repositoryOf = (runUrl) => runUrl?.split("/actions/")[0] ?? null;

class AdminReportsElement extends HTMLElement {
  async connectedCallback() {
    this.branchSelect = this.querySelector(".branch-select");
    this.querySelector(".previous").addEventListener("click", () => this.go(pageOf() - 1));
    this.querySelector(".next").addEventListener("click", () => this.go(pageOf() + 1));
    this.branchSelect.addEventListener("change", () => {
      this.branch = this.branchSelect.value;
      // IndexedDB can be unavailable (e.g. some private browsing modes).
      set(BRANCH_KEY, this.branch).catch(() => {});
      this.go(1);
    });
    window.addEventListener("popstate", () => this.show(pageOf()));
    this.branch = (await get(BRANCH_KEY).catch(() => undefined)) ?? DEFAULT_BRANCH;
    this.show(pageOf());
  }

  // The branches with reports, and the one picked even if it has none.
  showBranches(branches) {
    const names =
      branches.includes(this.branch) || !this.branch ? branches : [this.branch, ...branches];
    const [allBranches] = this.branchSelect.options;
    this.branchSelect.replaceChildren(allBranches, ...names.map((name) => new Option(name, name)));
    this.branchSelect.value = this.branch;
  }

  go(page) {
    window.history.pushState(null, "", page > 1 ? `?page=${page}` : window.location.pathname);
    this.show(page);
    window.scrollTo(0, 0);
  }

  async show(page) {
    const summary = this.querySelector(".summary");
    let data;
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (this.branch) {
        params.set("branch", this.branch);
      }
      const response = await fetch(`${REPORTS_URL}?${params}`);
      if (!response.ok) {
        throw new Error(`${REPORTS_URL} failed: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("Could not load the reports:", error);
      summary.textContent = message("adminReportsNotLoaded");
      return;
    }
    this.showBranches(data.branches ?? []);
    summary.textContent =
      data.total === 0
        ? message("adminNoReports")
        : message("adminReportCount", { count: data.total });
    const template = this.querySelector(".report-template");
    this.querySelector("tbody").replaceChildren(
      ...data.reports.map((report) => {
        const row = template.content.firstElementChild.cloneNode(true);
        const repository = repositoryOf(report.run_url);
        row.querySelector(".when").textContent = formatTime(report.created_at);
        const status = row.querySelector(".status");
        status.dataset.status = report.status;
        status.textContent = message(report.status === "passed" ? "adminPassed" : "adminFailed");
        row.querySelector(".counts").textContent = message("adminTestCounts", {
          passed: report.passed,
          failed: report.failed,
          flaky: report.flaky,
        });
        row.querySelector(".branch-name").textContent = report.branch ?? "";
        const pullRequest = row.querySelector(".pull-request");
        if (report.pull_request && repository) {
          pullRequest.hidden = false;
          pullRequest.href = `${repository}/pull/${report.pull_request}`;
          pullRequest.textContent = `#${report.pull_request}`;
        }
        const commit = row.querySelector(".commit");
        commit.textContent = report.commit_sha.slice(0, 7);
        if (repository) {
          commit.href = `${repository}/commit/${report.commit_sha}`;
        }
        row.querySelector(".duration").textContent = formatMinutes(report.duration_ms);
        row.querySelector(".open-report").href = `/${language()}/admin/reports/${report.id}/`;
        return row;
      })
    );
    this.querySelector(".pager").hidden = data.pages <= 1;
    this.querySelector(".page-of").textContent = message("adminPageOf", {
      page: data.page,
      pages: data.pages,
    });
    this.querySelector(".previous").disabled = data.page <= 1;
    this.querySelector(".next").disabled = data.page >= data.pages;
  }
}

customElements.define("ev-admin-reports", AdminReportsElement);

export { AdminReportsElement };
