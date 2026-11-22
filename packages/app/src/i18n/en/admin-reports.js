// English: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Branch",
    adminAllBranches: "All branches",
    adminReports: "Test reports",
    adminReportsDescription: "CI's Playwright reports, the latest first",
    adminResultColumn: "Result",
    adminBranchColumn: "Branch",
    adminCommitColumn: "Commit",
    adminReportColumn: "Report",
    adminOpenReport: "Open report",
  },
  messages: {
    adminReportsNotLoaded: "The reports couldn't be loaded. Try again.",
    adminNoReports: "No reports in the last 30 days.",
    adminReportCount: {
      one: "{count} report in the last 30 days",
      other: "{count} reports in the last 30 days",
    },
    adminPassed: "Passed",
    adminFailed: "Failed",
    adminTestCounts: "{passed} passed, {failed} failed, {flaky} flaky",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
