// Italian: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Errore",
    adminSourceColumn: "Dove",
    adminBrowserColumn: "Browser",
    adminOsColumn: "Sistema",
    adminErrorFilters: "Filtra gli errori",
    adminFilterAll: "Tutti",
    adminFilterSearch: "Cerca",
    adminFilterApply: "Applica",
    adminFilterClear: "Cancella i filtri",
    adminCountColumn: "Volte",
    adminUsersColumn: "Utenti",
    adminLastSeenColumn: "Ultima volta",
    adminFirstSeenColumn: "Prima volta",
    adminPages: "Pagine",
    adminPreviousPage: "Precedente",
    adminNextPage: "Successiva",
    adminAllErrors: "Tutti gli errori",
    adminTimeLabel: "Ora",
    adminUrlLabel: "URL",
    adminContextLabel: "Processo",
    adminBrowserLabel: "Browser",
    adminUserLabel: "Utente",
    adminCountryLabel: "Paese",
    adminStackTrace: "Stack trace",
    adminErrorsNotLoaded: "Impossibile caricare gli errori. Riprovi.",
    adminNoErrors: "Nessun errore negli ultimi 30 giorni.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} tipo di errore negli ultimi 30 giorni",
      other: "{count} tipi di errore negli ultimi 30 giorni",
    },
    adminOccurrences: {
      one: "Verificatosi {count} volta negli ultimi 30 giorni",
      other: "Verificatosi {count} volte negli ultimi 30 giorni",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Browser",
    },
  },
};

export { adminErrors };
