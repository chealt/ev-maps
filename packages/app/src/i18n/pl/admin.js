// Polski: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Przegląd",
    adminGroupCommunity: "Społeczność",
    adminGroupInsights: "Analizy",
    adminGroupEngineering: "Inżynieria",
    adminCollapseNav: "Zwiń nawigację",
    adminSignOut: "Wyloguj się",
    adminFilterRows: "Filtruj wiersze",
    adminNoMatchingRows: "Brak pasujących wierszy.",
    adminErrors: "Błędy",
    adminUsage: "Użycie",
  },
  messages: {
    adminSignedInAs: "Zalogowano jako {email}",
    adminSignedOut: "Zaloguj się kontem administratora, aby zobaczyć tę stronę.",
    // Shared by the admin pages with pages.
    adminPageOf: "Strona {page} z {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
