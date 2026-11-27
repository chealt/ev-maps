// Danish: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Oversigt",
    adminGroupCommunity: "Fællesskab",
    adminGroupInsights: "Indsigt",
    adminGroupEngineering: "Udvikling",
    adminCollapseNav: "Skjul navigationen",
    adminFilterRows: "Filtrér rækkerne",
    adminNoMatchingRows: "Ingen rækker passer.",
    adminErrors: "Fejl",
    adminUsage: "Brug",
  },
  messages: {
    adminSignedInAs: "Logget ind som {email}",
    adminSignedOut: "Log ind med en admin-konto for at se denne side.",
    // Shared by the admin pages with pages.
    adminPageOf: "Side {page} af {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
