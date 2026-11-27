// Slovak: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Vetva",
    adminAllBranches: "Všetky vetvy",
    adminReports: "Testovacie správy",
    adminReportsDescription: "Správy Playwright z CI, najnovšie ako prvé",
    adminResultColumn: "Výsledok",
    adminBranchColumn: "Vetva",
    adminCommitColumn: "Commit",
    adminReportColumn: "Správa",
    adminOpenReport: "Otvoriť správu",
  },
  messages: {
    adminReportsNotLoaded: "Správy sa nepodarilo načítať. Skúste to znova.",
    adminNoReports: "Za posledných 30 dní žiadne správy.",
    adminReportCount: {
      one: "{count} správa za posledných 30 dní",
      few: "{count} správy za posledných 30 dní",
      other: "{count} správ za posledných 30 dní",
    },
    adminPassed: "Úspešné",
    adminFailed: "Neúspešné",
    adminTestCounts: "{passed} úspešných, {failed} neúspešných, {flaky} nestabilných",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
