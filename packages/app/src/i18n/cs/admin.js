// Czech: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminSignOut: "Odhlásit se",
    adminOverview: "Přehled",
    adminGroupCommunity: "Komunita",
    adminGroupInsights: "Statistiky",
    adminGroupEngineering: "Vývoj",
    adminCollapseNav: "Sbalit navigaci",
    adminFilterRows: "Filtrovat řádky",
    adminNoMatchingRows: "Žádné řádky nevyhovují.",
    adminErrors: "Chyby",
    adminUsage: "Používání",
  },
  messages: {
    adminSignedInAs: "Přihlášen jako {email}",
    adminSignedOut: "Pro zobrazení této stránky se přihlaste administrátorským účtem.",
    // Shared by the admin pages with pages.
    adminPageOf: "Strana {page} z {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
