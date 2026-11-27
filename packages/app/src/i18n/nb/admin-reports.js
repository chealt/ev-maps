// Norsk bokmål: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Gren",
    adminAllBranches: "Alle grener",
    adminReports: "Testrapporter",
    adminReportsDescription: "CI-ens Playwright-rapporter, de nyeste først",
    adminResultColumn: "Resultat",
    adminBranchColumn: "Gren",
    adminCommitColumn: "Commit",
    adminReportColumn: "Rapport",
    adminOpenReport: "Åpne rapporten",
  },
  messages: {
    adminReportsNotLoaded: "Rapportene kunne ikke lastes. Prøv igjen.",
    adminNoReports: "Ingen rapporter de siste 30 dagene.",
    adminReportCount: {
      one: "{count} rapport de siste 30 dagene",
      other: "{count} rapporter de siste 30 dagene",
    },
    adminPassed: "Bestått",
    adminFailed: "Feilet",
    adminTestCounts: "{passed} bestått, {failed} feilet, {flaky} ustabile",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
