// Italian: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Panoramica",
    adminGroupCommunity: "Comunità",
    adminGroupInsights: "Analisi",
    adminGroupEngineering: "Sviluppo",
    adminCollapseNav: "Comprimi la navigazione",
    adminSignOut: "Esci",
    adminFilterRows: "Filtra le righe",
    adminNoMatchingRows: "Nessuna riga corrispondente.",
    adminErrors: "Errori",
    adminUsage: "Utilizzo",
  },
  messages: {
    adminSignedInAs: "Accesso effettuato come {email}",
    adminSignedOut: "Acceda con un account amministratore per vedere questa pagina.",
    // Shared by the admin pages with pages.
    adminPageOf: "Pagina {page} di {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
