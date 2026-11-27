// Français: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Branche",
    adminAllBranches: "Toutes les branches",
    adminReports: "Rapports de tests",
    adminReportsDescription: "Les rapports Playwright de la CI, les plus récents d'abord",
    adminResultColumn: "Résultat",
    adminBranchColumn: "Branche",
    adminCommitColumn: "Commit",
    adminReportColumn: "Rapport",
    adminOpenReport: "Ouvrir le rapport",
  },
  messages: {
    adminReportsNotLoaded: "Les rapports n'ont pas pu être chargés. Réessaie.",
    adminNoReports: "Aucun rapport ces 30 derniers jours.",
    adminReportCount: {
      one: "{count} rapport ces 30 derniers jours",
      other: "{count} rapports ces 30 derniers jours",
    },
    adminPassed: "Réussi",
    adminFailed: "Échoué",
    adminTestCounts: "{passed} réussis, {failed} échoués, {flaky} instables",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
