// Danish: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Prishistorik",
    adminPricesTracked: "Ladere med pris",
    adminPricesChangedToday: "Ændringer det seneste døgn",
    adminPricesLastGathered: "Senest hentet",
    adminPricesLookup: "Find en laders historik",
    adminPricesChargerId: "Lader-ID",
    adminPricesShow: "Vis",
    adminPricesUsual: "Normalt",
    adminPricesMin: "Lavest",
    adminPricesMax: "Højest",
    adminPricesNow: "Nu",
    adminPricesByHour: "Gennemsnit pr. time",
    adminPricesByDay: "Gennemsnit pr. ugedag",
    adminPricesChanges: "Ændringer",
    adminPricesRecent: "Seneste ændringer",
    adminPricesChargerColumn: "Lader",
    adminPricesTimeColumn: "Tid",
    adminPricesHourColumn: "Time",
    adminPricesDayColumn: "Dag",
    adminPricesPriceColumn: "Pris",
    adminPricesPreviousColumn: "Før",
  },
  messages: {
    adminPricesNotLoaded: "Prishistorikken kunne ikke indlæses. Prøv igen.",
    adminNoPrices: "Ingen priser hentet endnu.",
    adminPricesNoHistory: "Ingen prishistorik for {id}.",
    adminPricesChargerTitle: "{id}, seneste 30 dage",
    adminPricesSummary: {
      one: "{count} lader med pris, hentet hver time",
      other: "{count} ladere med pris, hentet hver time",
    },
  },
};

export { adminPrices };
