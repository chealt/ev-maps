// German: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Übersicht",
    adminGroupCommunity: "Community",
    adminGroupInsights: "Auswertungen",
    adminGroupEngineering: "Technik",
    adminCollapseNav: "Navigation einklappen",
    adminSignOut: "Abmelden",
    adminFilterRows: "Zeilen filtern",
    adminNoMatchingRows: "Keine passenden Zeilen.",
    adminErrors: "Fehler",
    adminUsage: "Nutzung",
  },
  messages: {
    adminSignedInAs: "Angemeldet als {email}",
    adminSignedOut: "Melde dich mit einem Admin-Konto an, um diese Seite zu sehen.",
    // Shared by the admin pages with pages.
    adminPageOf: "Seite {page} von {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
