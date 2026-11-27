// Norsk bokmål: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Feil",
    adminSourceColumn: "Hvor",
    adminBrowserColumn: "Nettleser",
    adminOsColumn: "System",
    adminErrorFilters: "Filtrer feilene",
    adminFilterAll: "Alle",
    adminFilterSearch: "Søk",
    adminFilterApply: "Bruk",
    adminFilterClear: "Fjern filtre",
    adminCountColumn: "Ganger",
    adminUsersColumn: "Brukere",
    adminLastSeenColumn: "Sist sett",
    adminFirstSeenColumn: "Først sett",
    adminPages: "Sider",
    adminPreviousPage: "Forrige",
    adminNextPage: "Neste",
    adminAllErrors: "Alle feil",
    adminTimeLabel: "Tid",
    adminUrlLabel: "URL",
    adminContextLabel: "Jobb",
    adminBrowserLabel: "Nettleser",
    adminUserLabel: "Bruker",
    adminCountryLabel: "Land",
    adminStackTrace: "Stakkspor",
    adminErrorsNotLoaded: "Feilene kunne ikke lastes. Prøv igjen.",
    adminNoErrors: "Ingen feil de siste 30 dagene.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} type feil de siste 30 dagene",
      other: "{count} typer feil de siste 30 dagene",
    },
    adminOccurrences: {
      one: "Skjedde {count} gang de siste 30 dagene",
      other: "Skjedde {count} ganger de siste 30 dagene",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Nettleser",
    },
  },
};

export { adminErrors };
