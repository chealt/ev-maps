// Czech: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Historie cen",
    adminPricesTracked: "Nabíječky s cenou",
    adminPricesChangedToday: "Změny za poslední den",
    adminPricesLastGathered: "Naposledy shromážděno",
    adminPricesLookup: "Najít historii nabíječky",
    adminPricesChargerId: "ID nabíječky",
    adminPricesShow: "Zobrazit",
    adminPricesUsual: "Obvykle",
    adminPricesMin: "Nejnižší",
    adminPricesMax: "Nejvyšší",
    adminPricesNow: "Nyní",
    adminPricesByHour: "Průměr podle hodiny",
    adminPricesByDay: "Průměr podle dne v týdnu",
    adminPricesChanges: "Změny",
    adminPricesRecent: "Poslední změny",
    adminPricesChargerColumn: "Nabíječka",
    adminPricesTimeColumn: "Čas",
    adminPricesHourColumn: "Hodina",
    adminPricesDayColumn: "Den",
    adminPricesPriceColumn: "Cena",
    adminPricesPreviousColumn: "Předtím",
  },
  messages: {
    adminPricesNotLoaded: "Historii cen se nepodařilo načíst. Zkuste to znovu.",
    adminNoPrices: "Zatím žádné shromážděné ceny.",
    adminPricesNoHistory: "Žádná historie cen pro {id}.",
    adminPricesChargerTitle: "{id}, posledních 30 dní",
    adminPricesSummary: {
      one: "{count} nabíječka s cenou, shromažďováno každou hodinu",
      few: "{count} nabíječky s cenou, shromažďováno každou hodinu",
      many: "{count} nabíječky s cenou, shromažďováno každou hodinu",
      other: "{count} nabíječek s cenou, shromažďováno každou hodinu",
    },
  },
};

export { adminPrices };
