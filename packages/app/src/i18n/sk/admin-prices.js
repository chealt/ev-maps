// Slovak: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "História cien",
    adminPricesTracked: "Nabíjačky s cenou",
    adminPricesChangedToday: "Zmeny za posledný deň",
    adminPricesLastGathered: "Naposledy zozbierané",
    adminPricesLookup: "Nájsť históriu nabíjačky",
    adminPricesChargerId: "ID nabíjačky",
    adminPricesShow: "Zobraziť",
    adminPricesUsual: "Zvyčajne",
    adminPricesMin: "Najnižšia",
    adminPricesMax: "Najvyššia",
    adminPricesNow: "Teraz",
    adminPricesByHour: "Priemer podľa hodiny",
    adminPricesByDay: "Priemer podľa dňa v týždni",
    adminPricesChanges: "Zmeny",
    adminPricesRecent: "Posledné zmeny",
    adminPricesChargerColumn: "Nabíjačka",
    adminPricesTimeColumn: "Čas",
    adminPricesHourColumn: "Hodina",
    adminPricesDayColumn: "Deň",
    adminPricesPriceColumn: "Cena",
    adminPricesPreviousColumn: "Predtým",
  },
  messages: {
    adminPricesNotLoaded: "Históriu cien sa nepodarilo načítať. Skúste to znova.",
    adminNoPrices: "Zatiaľ žiadne zozbierané ceny.",
    adminPricesNoHistory: "Žiadna história cien pre {id}.",
    adminPricesChargerTitle: "{id}, posledných 30 dní",
    adminPricesSummary: {
      one: "{count} nabíjačka s cenou, zbierané každú hodinu",
      few: "{count} nabíjačky s cenou, zbierané každú hodinu",
      many: "{count} nabíjačky s cenou, zbierané každú hodinu",
      other: "{count} nabíjačiek s cenou, zbierané každú hodinu",
    },
  },
};

export { adminPrices };
