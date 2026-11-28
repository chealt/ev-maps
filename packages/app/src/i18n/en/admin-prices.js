// English: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Price history",
    adminPricesTracked: "Chargers with a price",
    adminPricesChangedToday: "Changes in the last day",
    adminPricesLastGathered: "Last gathered",
    adminPricesLookup: "Find a charger's history",
    adminPricesChargerId: "Charger ID",
    adminPricesShow: "Show",
    adminPricesUsual: "Usual",
    adminPricesMin: "Lowest",
    adminPricesMax: "Highest",
    adminPricesNow: "Now",
    adminPricesByHour: "Average by hour of the day",
    adminPricesByDay: "Average by day of the week",
    adminPricesChanges: "Changes",
    adminPricesRecent: "Latest changes",
    adminPricesChargerColumn: "Charger",
    adminPricesTimeColumn: "Time",
    adminPricesHourColumn: "Hour",
    adminPricesDayColumn: "Day",
    adminPricesPriceColumn: "Price",
    adminPricesPreviousColumn: "Before",
  },
  messages: {
    adminPricesNotLoaded: "The price history couldn't be loaded. Try again.",
    adminNoPrices: "No prices gathered yet.",
    adminPricesNoHistory: "No price history for {id}.",
    adminPricesChargerTitle: "{id}, last 30 days",
    adminPricesSummary: {
      one: "{count} charger with a price, gathered hourly",
      other: "{count} chargers with a price, gathered hourly",
    },
  },
};

export { adminPrices };
