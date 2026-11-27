// Czech: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Chyba",
    adminSourceColumn: "Kde",
    adminBrowserColumn: "Prohlížeč",
    adminOsColumn: "Systém",
    adminErrorFilters: "Filtrovat chyby",
    adminFilterAll: "Všechny",
    adminFilterSearch: "Hledat",
    adminFilterApply: "Použít",
    adminFilterClear: "Zrušit filtry",
    adminCountColumn: "Počet",
    adminUsersColumn: "Uživatelé",
    adminLastSeenColumn: "Naposledy",
    adminFirstSeenColumn: "Poprvé",
    adminPages: "Stránky",
    adminPreviousPage: "Předchozí",
    adminNextPage: "Další",
    adminAllErrors: "Všechny chyby",
    adminTimeLabel: "Čas",
    adminUrlLabel: "URL",
    adminContextLabel: "Úloha",
    adminBrowserLabel: "Prohlížeč",
    adminUserLabel: "Uživatel",
    adminCountryLabel: "Země",
    adminStackTrace: "Zásobník volání",
    adminErrorsNotLoaded: "Chyby se nepodařilo načíst. Zkuste to znovu.",
    adminNoErrors: "Za posledních 30 dní žádné chyby.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} druh chyby za posledních 30 dní",
      few: "{count} druhy chyb za posledních 30 dní",
      other: "{count} druhů chyb za posledních 30 dní",
    },
    adminOccurrences: {
      one: "Vyskytla se {count}krát za posledních 30 dní",
      few: "Vyskytla se {count}krát za posledních 30 dní",
      other: "Vyskytla se {count}krát za posledních 30 dní",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Prohlížeč",
    },
  },
};

export { adminErrors };
