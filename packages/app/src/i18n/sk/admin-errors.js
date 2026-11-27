// Slovak: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Chyba",
    adminSourceColumn: "Kde",
    adminBrowserColumn: "Prehliadač",
    adminOsColumn: "Systém",
    adminErrorFilters: "Filtrovať chyby",
    adminFilterAll: "Všetky",
    adminFilterSearch: "Hľadať",
    adminFilterApply: "Použiť",
    adminFilterClear: "Zrušiť filtre",
    adminCountColumn: "Počet",
    adminUsersColumn: "Používatelia",
    adminLastSeenColumn: "Naposledy",
    adminFirstSeenColumn: "Prvýkrát",
    adminPages: "Strany",
    adminPreviousPage: "Predchádzajúca",
    adminNextPage: "Ďalšia",
    adminAllErrors: "Všetky chyby",
    adminTimeLabel: "Čas",
    adminUrlLabel: "URL",
    adminContextLabel: "Úloha",
    adminBrowserLabel: "Prehliadač",
    adminUserLabel: "Používateľ",
    adminCountryLabel: "Krajina",
    adminStackTrace: "Zásobník volaní",
    adminErrorsNotLoaded: "Chyby sa nepodarilo načítať. Skúste to znova.",
    adminNoErrors: "Za posledných 30 dní žiadne chyby.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} druh chyby za posledných 30 dní",
      few: "{count} druhy chýb za posledných 30 dní",
      other: "{count} druhov chýb za posledných 30 dní",
    },
    adminOccurrences: {
      one: "Vyskytla sa {count}-krát za posledných 30 dní",
      few: "Vyskytla sa {count}-krát za posledných 30 dní",
      other: "Vyskytla sa {count}-krát za posledných 30 dní",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Prehliadač",
    },
  },
};

export { adminErrors };
