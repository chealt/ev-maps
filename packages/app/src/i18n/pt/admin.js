// Portuguese: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Visão geral",
    adminGroupCommunity: "Comunidade",
    adminGroupInsights: "Análises",
    adminGroupEngineering: "Engenharia",
    adminCollapseNav: "Recolher a navegação",
    adminSignOut: "Terminar sessão",
    adminFilterRows: "Filtrar as linhas",
    adminNoMatchingRows: "Nenhuma linha corresponde.",
    adminErrors: "Erros",
    adminUsage: "Utilização",
  },
  messages: {
    adminSignedInAs: "Sessão iniciada como {email}",
    adminSignedOut: "Inicie sessão com uma conta de administrador para ver esta página.",
    // Shared by the admin pages with pages.
    adminPageOf: "Página {page} de {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
