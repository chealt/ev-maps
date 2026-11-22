// Polski: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Gałąź",
    adminAllBranches: "Wszystkie gałęzie",
    adminReports: "Raporty testów",
    adminReportsDescription: "raporty Playwright z CI, najnowsze najpierw",
    adminResultColumn: "Wynik",
    adminBranchColumn: "Gałąź",
    adminCommitColumn: "Commit",
    adminReportColumn: "Raport",
    adminOpenReport: "Otwórz raport",
  },
  messages: {
    adminReportsNotLoaded: "Nie udało się wczytać raportów. Spróbuj ponownie.",
    adminNoReports: "Brak raportów w ostatnich 30 dniach.",
    adminReportCount: {
      one: "{count} raport w ostatnich 30 dniach",
      few: "{count} raporty w ostatnich 30 dniach",
      many: "{count} raportów w ostatnich 30 dniach",
      other: "Raporty w ostatnich 30 dniach: {count}",
    },
    adminPassed: "Zaliczone",
    adminFailed: "Niezaliczone",
    adminTestCounts: "zaliczone: {passed}, niezaliczone: {failed}, niestabilne: {flaky}",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
