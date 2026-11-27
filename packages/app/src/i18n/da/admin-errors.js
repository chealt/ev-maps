// Danish: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Fejl",
    adminSourceColumn: "Hvor",
    adminBrowserColumn: "Browser",
    adminOsColumn: "System",
    adminErrorFilters: "Filtrér fejlene",
    adminFilterAll: "Alle",
    adminFilterSearch: "Søg",
    adminFilterApply: "Anvend",
    adminFilterClear: "Ryd filtre",
    adminCountColumn: "Gange",
    adminUsersColumn: "Brugere",
    adminLastSeenColumn: "Senest set",
    adminFirstSeenColumn: "Først set",
    adminPages: "Sider",
    adminPreviousPage: "Forrige",
    adminNextPage: "Næste",
    adminAllErrors: "Alle fejl",
    adminTimeLabel: "Tidspunkt",
    adminUrlLabel: "URL",
    adminContextLabel: "Job",
    adminBrowserLabel: "Browser",
    adminUserLabel: "Bruger",
    adminCountryLabel: "Land",
    adminStackTrace: "Stack trace",
    adminErrorsNotLoaded: "Fejlene kunne ikke indlæses. Prøv igen.",
    adminNoErrors: "Ingen fejl de seneste 30 dage.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} type fejl de seneste 30 dage",
      other: "{count} typer fejl de seneste 30 dage",
    },
    adminOccurrences: {
      one: "Sket {count} gang de seneste 30 dage",
      other: "Sket {count} gange de seneste 30 dage",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Browser",
    },
  },
};

export { adminErrors };
