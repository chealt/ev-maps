// Norwegian: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Prishistorikk",
    adminPricesTracked: "Ladere med pris",
    adminPricesChangedToday: "Endringer siste døgn",
    adminPricesLastGathered: "Sist hentet",
    adminPricesLookup: "Finn en laders historikk",
    adminPricesChargerId: "Lader-ID",
    adminPricesShow: "Vis",
    adminPricesUsual: "Vanlig",
    adminPricesMin: "Lavest",
    adminPricesMax: "Høyest",
    adminPricesNow: "Nå",
    adminPricesByHour: "Gjennomsnitt per time",
    adminPricesByDay: "Gjennomsnitt per ukedag",
    adminPricesChanges: "Endringer",
    adminPricesRecent: "Siste endringer",
    adminPricesChargerColumn: "Lader",
    adminPricesTimeColumn: "Tid",
    adminPricesHourColumn: "Time",
    adminPricesDayColumn: "Dag",
    adminPricesPriceColumn: "Pris",
    adminPricesPreviousColumn: "Før",
  },
  messages: {
    adminPricesNotLoaded: "Prishistorikken kunne ikke lastes. Prøv igjen.",
    adminNoPrices: "Ingen priser hentet ennå.",
    adminPricesNoHistory: "Ingen prishistorikk for {id}.",
    adminPricesChargerTitle: "{id}, siste 30 dager",
    adminPricesSummary: {
      one: "{count} lader med pris, hentet hver time",
      other: "{count} ladere med pris, hentet hver time",
    },
  },
};

export { adminPrices };
