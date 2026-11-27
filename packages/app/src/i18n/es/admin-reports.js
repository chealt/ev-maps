// Spanish: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Rama",
    adminAllBranches: "Todas las ramas",
    adminReports: "Informes de pruebas",
    adminReportsDescription: "Informes de Playwright de la CI, los más recientes primero",
    adminResultColumn: "Resultado",
    adminBranchColumn: "Rama",
    adminCommitColumn: "Commit",
    adminReportColumn: "Informe",
    adminOpenReport: "Abrir informe",
  },
  messages: {
    adminReportsNotLoaded: "No se han podido cargar los informes. Inténtalo de nuevo.",
    adminNoReports: "No hay informes en los últimos 30 días.",
    adminReportCount: {
      one: "{count} informe en los últimos 30 días",
      other: "{count} informes en los últimos 30 días",
    },
    adminPassed: "Superado",
    adminFailed: "Fallido",
    adminTestCounts: "{passed} superadas, {failed} fallidas, {flaky} inestables",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
