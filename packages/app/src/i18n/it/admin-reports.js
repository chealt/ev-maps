// Italian: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Branch",
    adminAllBranches: "Tutti i branch",
    adminReports: "Report dei test",
    adminReportsDescription: "I report Playwright della CI, dal più recente",
    adminResultColumn: "Esito",
    adminBranchColumn: "Branch",
    adminCommitColumn: "Commit",
    adminReportColumn: "Report",
    adminOpenReport: "Apri il report",
  },
  messages: {
    adminReportsNotLoaded: "Impossibile caricare i report. Riprovi.",
    adminNoReports: "Nessun report negli ultimi 30 giorni.",
    adminReportCount: {
      one: "{count} report negli ultimi 30 giorni",
      other: "{count} report negli ultimi 30 giorni",
    },
    adminPassed: "Superato",
    adminFailed: "Non superato",
    adminTestCounts: "{passed} superati, {failed} non superati, {flaky} instabili",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
