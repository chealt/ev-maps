// Hungarian: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Árelőzmények",
    adminPricesTracked: "Töltők árral",
    adminPricesChangedToday: "Változások az elmúlt napban",
    adminPricesLastGathered: "Utolsó gyűjtés",
    adminPricesLookup: "Töltő előzményeinek keresése",
    adminPricesChargerId: "Töltő azonosító",
    adminPricesShow: "Mutasd",
    adminPricesUsual: "Szokásos",
    adminPricesMin: "Legalacsonyabb",
    adminPricesMax: "Legmagasabb",
    adminPricesNow: "Most",
    adminPricesByHour: "Átlag a nap óráiban",
    adminPricesByDay: "Átlag a hét napjain",
    adminPricesChanges: "Változások",
    adminPricesRecent: "Legutóbbi változások",
    adminPricesChargerColumn: "Töltő",
    adminPricesTimeColumn: "Idő",
    adminPricesHourColumn: "Óra",
    adminPricesDayColumn: "Nap",
    adminPricesPriceColumn: "Ár",
    adminPricesPreviousColumn: "Előtte",
  },
  messages: {
    adminPricesNotLoaded: "Az árelőzményeket nem sikerült betölteni. Próbáld újra.",
    adminNoPrices: "Még nincs begyűjtött ár.",
    adminPricesNoHistory: "Nincs árelőzmény ehhez: {id}.",
    adminPricesChargerTitle: "{id}, elmúlt 30 nap",
    adminPricesSummary: {
      one: "{count} töltő árral, óránként gyűjtve",
      other: "{count} töltő árral, óránként gyűjtve",
    },
  },
};

export { adminPrices };
