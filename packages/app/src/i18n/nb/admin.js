// Norsk bokmål: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Oversikt",
    adminGroupCommunity: "Fellesskap",
    adminGroupInsights: "Innsikt",
    adminGroupEngineering: "Utvikling",
    adminCollapseNav: "Skjul navigasjonen",
    adminFilterRows: "Filtrer radene",
    adminNoMatchingRows: "Ingen rader passer.",
    adminErrors: "Feil",
    adminUsage: "Bruk",
  },
  messages: {
    adminSignedInAs: "Logget inn som {email}",
    adminSignedOut: "Logg inn med en adminkonto for å se denne siden.",
    // Shared by the admin pages with pages.
    adminPageOf: "Side {page} av {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
