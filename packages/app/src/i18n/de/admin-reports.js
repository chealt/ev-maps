// German: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Branch",
    adminAllBranches: "Alle Branches",
    adminReports: "Testberichte",
    adminReportsDescription: "Die Playwright-Berichte der CI, die neuesten zuerst",
    adminResultColumn: "Ergebnis",
    adminBranchColumn: "Branch",
    adminCommitColumn: "Commit",
    adminReportColumn: "Bericht",
    adminOpenReport: "Bericht öffnen",
  },
  messages: {
    adminReportsNotLoaded: "Die Berichte konnten nicht geladen werden. Versuche es erneut.",
    adminNoReports: "Keine Berichte in den letzten 30 Tagen.",
    adminReportCount: {
      one: "{count} Bericht in den letzten 30 Tagen",
      other: "{count} Berichte in den letzten 30 Tagen",
    },
    adminPassed: "Bestanden",
    adminFailed: "Fehlgeschlagen",
    adminTestCounts: "{passed} bestanden, {failed} fehlgeschlagen, {flaky} instabil",
    adminMinutes: "{value} Min.",
  },
};

export { adminReports };
