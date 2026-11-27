// Czech: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Větev",
    adminAllBranches: "Všechny větve",
    adminReports: "Testovací zprávy",
    adminReportsDescription: "Zprávy Playwright z CI, nejnovější jako první",
    adminResultColumn: "Výsledek",
    adminBranchColumn: "Větev",
    adminCommitColumn: "Commit",
    adminReportColumn: "Zpráva",
    adminOpenReport: "Otevřít zprávu",
  },
  messages: {
    adminReportsNotLoaded: "Zprávy se nepodařilo načíst. Zkuste to znovu.",
    adminNoReports: "Za posledních 30 dní žádné zprávy.",
    adminReportCount: {
      one: "{count} zpráva za posledních 30 dní",
      few: "{count} zprávy za posledních 30 dní",
      other: "{count} zpráv za posledních 30 dní",
    },
    adminPassed: "Úspěšné",
    adminFailed: "Neúspěšné",
    adminTestCounts: "{passed} úspěšných, {failed} neúspěšných, {flaky} nestabilních",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
