// Magyar: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Áttekintés",
    adminGroupCommunity: "Közösség",
    adminGroupInsights: "Elemzések",
    adminGroupEngineering: "Fejlesztés",
    adminCollapseNav: "Navigáció összecsukása",
    adminErrors: "Hibák",
    adminUsage: "Használat",
  },
  messages: {
    adminSignedInAs: "Bejelentkezve: {email}",
    adminSignedOut: "Jelentkezz be adminisztrátori fiókkal az oldal megtekintéséhez.",
    // Shared by the admin pages with pages.
    adminPageOf: "{page}. oldal / {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
