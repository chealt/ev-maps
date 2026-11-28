// Italian: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Storico dei prezzi",
    adminPricesTracked: "Colonnine con prezzo",
    adminPricesChangedToday: "Modifiche nell’ultimo giorno",
    adminPricesLastGathered: "Ultima raccolta",
    adminPricesLookup: "Trova lo storico di una colonnina",
    adminPricesChargerId: "ID colonnina",
    adminPricesShow: "Mostra",
    adminPricesUsual: "Di solito",
    adminPricesMin: "Minimo",
    adminPricesMax: "Massimo",
    adminPricesNow: "Ora",
    adminPricesByHour: "Media per ora del giorno",
    adminPricesByDay: "Media per giorno della settimana",
    adminPricesChanges: "Modifiche",
    adminPricesRecent: "Ultime modifiche",
    adminPricesChargerColumn: "Colonnina",
    adminPricesTimeColumn: "Ora",
    adminPricesHourColumn: "Ora",
    adminPricesDayColumn: "Giorno",
    adminPricesPriceColumn: "Prezzo",
    adminPricesPreviousColumn: "Prima",
  },
  messages: {
    adminPricesNotLoaded: "Impossibile caricare lo storico dei prezzi. Riprova.",
    adminNoPrices: "Nessun prezzo raccolto finora.",
    adminPricesNoHistory: "Nessuno storico dei prezzi per {id}.",
    adminPricesChargerTitle: "{id}, ultimi 30 giorni",
    adminPricesSummary: {
      one: "{count} colonnina con prezzo, raccolto ogni ora",
      other: "{count} colonnine con prezzo, raccolti ogni ora",
    },
  },
};

export { adminPrices };
