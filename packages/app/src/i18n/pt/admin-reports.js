// Portuguese: the admin area's test reports page. See ../index.js for how
// the sections are put together and which pages get which.

const adminReports = {
  page: {
    adminBranchFilter: "Ramo",
    adminAllBranches: "Todos os ramos",
    adminReports: "Relatórios de testes",
    adminReportsDescription: "Os relatórios do Playwright da CI, os mais recentes primeiro",
    adminResultColumn: "Resultado",
    adminBranchColumn: "Ramo",
    adminCommitColumn: "Commit",
    adminReportColumn: "Relatório",
    adminOpenReport: "Abrir relatório",
  },
  messages: {
    adminReportsNotLoaded: "Não foi possível carregar os relatórios. Tente novamente.",
    adminNoReports: "Sem relatórios nos últimos 30 dias.",
    adminReportCount: {
      one: "{count} relatório nos últimos 30 dias",
      other: "{count} relatórios nos últimos 30 dias",
    },
    adminPassed: "Aprovado",
    adminFailed: "Falhado",
    adminTestCounts: "{passed} aprovados, {failed} falhados, {flaky} instáveis",
    adminMinutes: "{value} min",
  },
};

export { adminReports };
