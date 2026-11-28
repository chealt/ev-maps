// Swedish: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Prishistorik",
    adminPricesTracked: "Laddare med pris",
    adminPricesChangedToday: "Ändringar senaste dygnet",
    adminPricesLastGathered: "Senast hämtat",
    adminPricesLookup: "Hitta en laddares historik",
    adminPricesChargerId: "Laddar-ID",
    adminPricesShow: "Visa",
    adminPricesUsual: "Vanligt",
    adminPricesMin: "Lägst",
    adminPricesMax: "Högst",
    adminPricesNow: "Nu",
    adminPricesByHour: "Genomsnitt per timme",
    adminPricesByDay: "Genomsnitt per veckodag",
    adminPricesChanges: "Ändringar",
    adminPricesRecent: "Senaste ändringar",
    adminPricesChargerColumn: "Laddare",
    adminPricesTimeColumn: "Tid",
    adminPricesHourColumn: "Timme",
    adminPricesDayColumn: "Dag",
    adminPricesPriceColumn: "Pris",
    adminPricesPreviousColumn: "Före",
  },
  messages: {
    adminPricesNotLoaded: "Prishistoriken kunde inte läsas in. Försök igen.",
    adminNoPrices: "Inga priser hämtade ännu.",
    adminPricesNoHistory: "Ingen prishistorik för {id}.",
    adminPricesChargerTitle: "{id}, senaste 30 dagarna",
    adminPricesSummary: {
      one: "{count} laddare med pris, hämtas varje timme",
      other: "{count} laddare med pris, hämtas varje timme",
    },
  },
};

export { adminPrices };
