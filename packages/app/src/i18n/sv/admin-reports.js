// Swedish: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Gren",
    adminAllBranches: "Alla grenar",
    adminReports: "Testrapporter",
    adminReportsDescription: "CI:s Playwright-rapporter, de senaste först",
    adminResultColumn: "Resultat",
    adminBranchColumn: "Gren",
    adminCommitColumn: "Commit",
    adminReportColumn: "Rapport",
    adminOpenReport: "Öppna rapporten",
  },
  messages: {
    adminReportsNotLoaded: "Rapporterna kunde inte laddas. Försök igen.",
    adminNoReports: "Inga rapporter de senaste 30 dagarna.",
    adminReportCount: {
      one: "{count} rapport de senaste 30 dagarna",
      other: "{count} rapporter de senaste 30 dagarna",
    },
    adminPassed: "Godkänd",
    adminFailed: "Misslyckad",
    adminTestCounts: "{passed} godkända, {failed} misslyckade, {flaky} instabila",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
