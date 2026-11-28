// Danish: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Branch",
    adminAllBranches: "Alle branches",
    adminReports: "Testrapporter",
    adminReportsDescription: "CI's Playwright-rapporter, nyeste først",
    adminResultColumn: "Resultat",
    adminBranchColumn: "Branch",
    adminCommitColumn: "Commit",
    adminReportColumn: "Rapport",
    adminOpenReport: "Åbn rapport",
  },
  messages: {
    adminReportsNotLoaded: "Rapporterne kunne ikke indlæses. Prøv igen.",
    adminNoReports: "Ingen rapporter de seneste 30 dage.",
    adminReportCount: {
      one: "{count} rapport de seneste 30 dage",
      other: "{count} rapporter de seneste 30 dage",
    },
    adminPassed: "Bestået",
    adminFailed: "Fejlet",
    adminTestCounts: "{passed} bestået, {failed} fejlet, {flaky} ustabile",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
