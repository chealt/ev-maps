// Swedish: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Fel",
    adminSourceColumn: "Var",
    adminBrowserColumn: "Webbläsare",
    adminOsColumn: "System",
    adminErrorFilters: "Filtrera felen",
    adminFilterAll: "Alla",
    adminFilterSearch: "Sök",
    adminFilterApply: "Använd",
    adminFilterClear: "Rensa filter",
    adminCountColumn: "Gånger",
    adminUsersColumn: "Användare",
    adminLastSeenColumn: "Senast sedd",
    adminFirstSeenColumn: "Först sedd",
    adminPages: "Sidor",
    adminPreviousPage: "Föregående",
    adminNextPage: "Nästa",
    adminAllErrors: "Alla fel",
    adminTimeLabel: "Tid",
    adminUrlLabel: "URL",
    adminContextLabel: "Jobb",
    adminBrowserLabel: "Webbläsare",
    adminUserLabel: "Användare",
    adminCountryLabel: "Land",
    adminStackTrace: "Stackspårning",
    adminErrorsNotLoaded: "Felen kunde inte laddas. Försök igen.",
    adminNoErrors: "Inga fel de senaste 30 dagarna.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} typ av fel de senaste 30 dagarna",
      other: "{count} typer av fel de senaste 30 dagarna",
    },
    adminOccurrences: {
      one: "Inträffade {count} gång de senaste 30 dagarna",
      other: "Inträffade {count} gånger de senaste 30 dagarna",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Webbläsare",
    },
  },
};

export { adminErrors };
