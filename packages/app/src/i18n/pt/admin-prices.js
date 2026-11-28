// Portuguese: the admin area's price history page (#463). See ../index.js for
// how the sections are put together and which pages get which.

const adminPrices = {
  page: {
    adminPrices: "Histórico de preços",
    adminPricesTracked: "Carregadores com preço",
    adminPricesChangedToday: "Alterações no último dia",
    adminPricesLastGathered: "Última recolha",
    adminPricesLookup: "Encontrar o histórico de um carregador",
    adminPricesChargerId: "ID do carregador",
    adminPricesShow: "Mostrar",
    adminPricesUsual: "Habitual",
    adminPricesMin: "Mínimo",
    adminPricesMax: "Máximo",
    adminPricesNow: "Agora",
    adminPricesByHour: "Média por hora do dia",
    adminPricesByDay: "Média por dia da semana",
    adminPricesChanges: "Alterações",
    adminPricesRecent: "Últimas alterações",
    adminPricesChargerColumn: "Carregador",
    adminPricesTimeColumn: "Hora",
    adminPricesHourColumn: "Hora",
    adminPricesDayColumn: "Dia",
    adminPricesPriceColumn: "Preço",
    adminPricesPreviousColumn: "Antes",
  },
  messages: {
    adminPricesNotLoaded: "Não foi possível carregar o histórico de preços. Tente novamente.",
    adminNoPrices: "Ainda não há preços recolhidos.",
    adminPricesNoHistory: "Sem histórico de preços para {id}.",
    adminPricesChargerTitle: "{id}, últimos 30 dias",
    adminPricesSummary: {
      one: "{count} carregador com preço, recolhido a cada hora",
      other: "{count} carregadores com preço, recolhidos a cada hora",
    },
  },
};

export { adminPrices };
