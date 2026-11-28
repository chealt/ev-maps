// German: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Preisverlauf",
    adminPricesTracked: "Ladestationen mit Preis",
    adminPricesChangedToday: "Änderungen am letzten Tag",
    adminPricesLastGathered: "Zuletzt erfasst",
    adminPricesLookup: "Verlauf einer Ladestation finden",
    adminPricesChargerId: "Ladestations-ID",
    adminPricesShow: "Anzeigen",
    adminPricesUsual: "Üblich",
    adminPricesMin: "Niedrigster",
    adminPricesMax: "Höchster",
    adminPricesNow: "Jetzt",
    adminPricesByHour: "Durchschnitt nach Tageszeit",
    adminPricesByDay: "Durchschnitt nach Wochentag",
    adminPricesChanges: "Änderungen",
    adminPricesRecent: "Letzte Änderungen",
    adminPricesChargerColumn: "Ladestation",
    adminPricesTimeColumn: "Zeit",
    adminPricesHourColumn: "Stunde",
    adminPricesDayColumn: "Tag",
    adminPricesPriceColumn: "Preis",
    adminPricesPreviousColumn: "Vorher",
  },
  messages: {
    adminPricesNotLoaded: "Der Preisverlauf konnte nicht geladen werden. Versuche es erneut.",
    adminNoPrices: "Noch keine Preise erfasst.",
    adminPricesNoHistory: "Kein Preisverlauf für {id}.",
    adminPricesChargerTitle: "{id}, letzte 30 Tage",
    adminPricesSummary: {
      one: "{count} Ladestation mit Preis, stündlich erfasst",
      other: "{count} Ladestationen mit Preis, stündlich erfasst",
    },
  },
};

export { adminPrices };
