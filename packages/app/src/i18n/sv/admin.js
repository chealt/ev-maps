// Swedish: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Översikt",
    adminGroupCommunity: "Community",
    adminGroupInsights: "Insikter",
    adminGroupEngineering: "Teknik",
    adminCollapseNav: "Fäll ihop navigeringen",
    adminSignOut: "Logga ut",
    adminFilterRows: "Filtrera raderna",
    adminNoMatchingRows: "Inga rader matchar.",
    adminErrors: "Fel",
    adminUsage: "Användning",
    adminSponsors: "Sponsorer",
  },
  messages: {
    adminSignedInAs: "Inloggad som {email}",
    adminSignedOut: "Logga in med ett adminkonto för att se den här sidan.",
    // Shared by the admin pages with pages.
    adminPageOf: "Sida {page} av {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
