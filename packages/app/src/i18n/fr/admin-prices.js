// French: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Historique des prix",
    adminPricesTracked: "Bornes avec un prix",
    adminPricesChangedToday: "Changements sur le dernier jour",
    adminPricesLastGathered: "Dernière collecte",
    adminPricesLookup: "Trouver l’historique d’une borne",
    adminPricesChargerId: "ID de la borne",
    adminPricesShow: "Afficher",
    adminPricesUsual: "Habituel",
    adminPricesMin: "Le plus bas",
    adminPricesMax: "Le plus haut",
    adminPricesNow: "Actuel",
    adminPricesByHour: "Moyenne par heure de la journée",
    adminPricesByDay: "Moyenne par jour de la semaine",
    adminPricesChanges: "Changements",
    adminPricesRecent: "Derniers changements",
    adminPricesChargerColumn: "Borne",
    adminPricesTimeColumn: "Heure",
    adminPricesHourColumn: "Heure",
    adminPricesDayColumn: "Jour",
    adminPricesPriceColumn: "Prix",
    adminPricesPreviousColumn: "Avant",
  },
  messages: {
    adminPricesNotLoaded: "L’historique des prix n’a pas pu être chargé. Réessayez.",
    adminNoPrices: "Aucun prix collecté pour l’instant.",
    adminPricesNoHistory: "Aucun historique de prix pour {id}.",
    adminPricesChargerTitle: "{id}, 30 derniers jours",
    adminPricesSummary: {
      one: "{count} borne avec un prix, collecté chaque heure",
      other: "{count} bornes avec un prix, collectés chaque heure",
    },
  },
};

export { adminPrices };
