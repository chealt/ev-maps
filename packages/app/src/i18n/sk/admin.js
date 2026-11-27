// Slovak: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Prehľad",
    adminGroupCommunity: "Komunita",
    adminGroupInsights: "Štatistiky",
    adminGroupEngineering: "Vývoj",
    adminCollapseNav: "Zbaliť navigáciu",
    adminSignOut: "Odhlásiť sa",
    adminFilterRows: "Filtrovať riadky",
    adminNoMatchingRows: "Žiadne riadky nevyhovujú.",
    adminErrors: "Chyby",
    adminUsage: "Používanie",
  },
  messages: {
    adminSignedInAs: "Prihlásený ako {email}",
    adminSignedOut: "Na zobrazenie tejto stránky sa prihláste administrátorským účtom.",
    // Shared by the admin pages with pages.
    adminPageOf: "Strana {page} z {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
