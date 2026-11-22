// Magyar: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminReports: "Tesztjelentések",
    adminReportsDescription: "a CI Playwright-jelentései, a legújabbal kezdve",
    adminResultColumn: "Eredmény",
    adminBranchColumn: "Ág",
    adminCommitColumn: "Commit",
    adminReportColumn: "Jelentés",
    adminOpenReport: "Jelentés megnyitása",
  },
  messages: {
    adminReportsNotLoaded: "Nem sikerült betölteni a jelentéseket. Próbáld újra.",
    adminNoReports: "Nincs jelentés az elmúlt 30 napban.",
    adminReportCount: {
      one: "{count} jelentés az elmúlt 30 napban",
      other: "{count} jelentés az elmúlt 30 napban",
    },
    adminPassed: "Sikeres",
    adminFailed: "Sikertelen",
    adminTestCounts: "{passed} sikeres, {failed} sikertelen, {flaky} ingadozó",
    adminMinutes: "{value} perc",
  },
};

export { adminReports };
