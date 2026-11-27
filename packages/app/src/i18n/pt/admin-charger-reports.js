// Portuguese: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Alterações comunicadas",
    adminApproveReport: "Aprovar",
    adminTrust: "Confiança",
    adminTrustFactors: "Em que se baseia a confiança",
    adminReportedAvailability: "Disponibilidade",
    adminReportedPrice: "Preço",
    adminReceiptPhoto: "Fotografia do recibo, da fatura ou da aplicação de carregamento",
  },
  messages: {
    adminReportsNotLoaded: "Não foi possível carregar as alterações comunicadas. Tente novamente.",
    adminNoChargerReports: "Não foram encontradas alterações comunicadas.",
    adminChargerReportCount: {
      one: "{count} alteração comunicada",
      other: "{count} alterações comunicadas",
    },
    adminReportedBy: "Comunicado por {email} em {date}",
    adminChargerPhoto: "Fotografia do carregador",
    adminReceiptPhoto: "Fotografia do recibo, da fatura ou da aplicação de carregamento",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratuito",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} por sessão",
    adminDeviceDistance: "O dispositivo estava a {distance} m do carregador",
    adminDeviceDistanceAccuracy:
      "O dispositivo estava a {distance} m do carregador (±{accuracy} m)",
    adminNoDeviceLocation: "A localização do dispositivo não foi partilhada",
  },
  values: {
    status: {
      operational: "Operacional",
      "not-operational": "Não operacional",
      "temporarily-unavailable": "Temporariamente indisponível",
      planned: "Planeado",
      "partly-operational": "Parcialmente operacional",
      "in-use": "Em utilização",
      removed: "Removido",
    },
    trustFactors: {
      location: "Localização",
      chargerPhoto: "Fotografia do carregador",
      receiptPhoto: "Fotografia do recibo",
      approvedBefore: "Aprovações anteriores",
      rejectedBefore: "Rejeições anteriores",
      accountAge: "Antiguidade da conta",
      signIns: "Inícios de sessão",
      favorites: "Favoritos",
    },
  },
};

export { adminChargerReports };
