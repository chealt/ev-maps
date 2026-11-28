// Spanish: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Historial de precios",
    adminPricesTracked: "Cargadores con precio",
    adminPricesChangedToday: "Cambios en el último día",
    adminPricesLastGathered: "Última recogida",
    adminPricesLookup: "Buscar el historial de un cargador",
    adminPricesChargerId: "ID del cargador",
    adminPricesShow: "Mostrar",
    adminPricesUsual: "Habitual",
    adminPricesMin: "Mínimo",
    adminPricesMax: "Máximo",
    adminPricesNow: "Ahora",
    adminPricesByHour: "Media por hora del día",
    adminPricesByDay: "Media por día de la semana",
    adminPricesChanges: "Cambios",
    adminPricesRecent: "Últimos cambios",
    adminPricesChargerColumn: "Cargador",
    adminPricesTimeColumn: "Hora",
    adminPricesHourColumn: "Hora",
    adminPricesDayColumn: "Día",
    adminPricesPriceColumn: "Precio",
    adminPricesPreviousColumn: "Antes",
  },
  messages: {
    adminPricesNotLoaded: "No se pudo cargar el historial de precios. Inténtalo de nuevo.",
    adminNoPrices: "Aún no hay precios recogidos.",
    adminPricesNoHistory: "No hay historial de precios para {id}.",
    adminPricesChargerTitle: "{id}, últimos 30 días",
    adminPricesSummary: {
      one: "{count} cargador con precio, recogido cada hora",
      other: "{count} cargadores con precio, recogidos cada hora",
    },
  },
};

export { adminPrices };
