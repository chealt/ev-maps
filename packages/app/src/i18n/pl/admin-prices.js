// Polish: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Historia cen",
    adminPricesTracked: "Ładowarki z ceną",
    adminPricesChangedToday: "Zmiany w ostatniej dobie",
    adminPricesLastGathered: "Ostatnio zebrano",
    adminPricesLookup: "Znajdź historię ładowarki",
    adminPricesChargerId: "ID ładowarki",
    adminPricesShow: "Pokaż",
    adminPricesUsual: "Zwykle",
    adminPricesMin: "Najniższa",
    adminPricesMax: "Najwyższa",
    adminPricesNow: "Teraz",
    adminPricesByHour: "Średnia według godziny",
    adminPricesByDay: "Średnia według dnia tygodnia",
    adminPricesChanges: "Zmiany",
    adminPricesRecent: "Ostatnie zmiany",
    adminPricesChargerColumn: "Ładowarka",
    adminPricesTimeColumn: "Czas",
    adminPricesHourColumn: "Godzina",
    adminPricesDayColumn: "Dzień",
    adminPricesPriceColumn: "Cena",
    adminPricesPreviousColumn: "Wcześniej",
  },
  messages: {
    adminPricesNotLoaded: "Nie udało się wczytać historii cen. Spróbuj ponownie.",
    adminNoPrices: "Nie zebrano jeszcze cen.",
    adminPricesNoHistory: "Brak historii cen dla {id}.",
    adminPricesChargerTitle: "{id}, ostatnie 30 dni",
    adminPricesSummary: {
      one: "{count} ładowarka z ceną, zbierane co godzinę",
      few: "{count} ładowarki z ceną, zbierane co godzinę",
      many: "{count} ładowarek z ceną, zbierane co godzinę",
      other: "{count} ładowarki z ceną, zbierane co godzinę",
    },
  },
};

export { adminPrices };
