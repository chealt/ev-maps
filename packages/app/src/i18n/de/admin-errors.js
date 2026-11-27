// German: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Fehler",
    adminSourceColumn: "Wo",
    adminBrowserColumn: "Browser",
    adminOsColumn: "System",
    adminErrorFilters: "Fehler filtern",
    adminFilterAll: "Alle",
    adminFilterSearch: "Suchen",
    adminFilterApply: "Anwenden",
    adminFilterClear: "Filter zurücksetzen",
    adminCountColumn: "Anzahl",
    adminUsersColumn: "Nutzer",
    adminLastSeenColumn: "Zuletzt gesehen",
    adminFirstSeenColumn: "Zuerst gesehen",
    adminPages: "Seiten",
    adminPreviousPage: "Zurück",
    adminNextPage: "Weiter",
    adminAllErrors: "Alle Fehler",
    adminTimeLabel: "Zeit",
    adminUrlLabel: "URL",
    adminContextLabel: "Job",
    adminBrowserLabel: "Browser",
    adminUserLabel: "Nutzer",
    adminCountryLabel: "Land",
    adminStackTrace: "Stacktrace",
    adminErrorsNotLoaded: "Die Fehler konnten nicht geladen werden. Versuche es erneut.",
    adminNoErrors: "Keine Fehler in den letzten 30 Tagen.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} Fehlerart in den letzten 30 Tagen",
      other: "{count} Fehlerarten in den letzten 30 Tagen",
    },
    adminOccurrences: {
      one: "{count}-mal in den letzten 30 Tagen aufgetreten",
      other: "{count}-mal in den letzten 30 Tagen aufgetreten",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Browser",
    },
  },
};

export { adminErrors };
