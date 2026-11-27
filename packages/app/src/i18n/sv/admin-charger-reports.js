// Swedish: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Rapporterade ändringar",
    adminApproveReport: "Godkänn",
    adminTrust: "Förtroende",
    adminTrustFactors: "Vad förtroendet bygger på",
    adminReportedAvailability: "Tillgänglighet",
    adminReportedPrice: "Pris",
    adminReceiptPhoto: "Foto av kvitto, faktura eller laddapp",
  },
  messages: {
    adminReportsNotLoaded: "De rapporterade ändringarna kunde inte laddas. Försök igen.",
    adminNoChargerReports: "Inga rapporterade ändringar hittades.",
    adminChargerReportCount: {
      one: "{count} rapporterad ändring",
      other: "{count} rapporterade ändringar",
    },
    adminReportedBy: "Rapporterad av {email} den {date}",
    adminChargerPhoto: "Foto av laddstationen",
    adminReceiptPhoto: "Foto av kvitto, faktura eller laddapp",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratis",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} per laddning",
    adminDeviceDistance: "Enheten var {distance} m från laddstationen",
    adminDeviceDistanceAccuracy: "Enheten var {distance} m från laddstationen (±{accuracy} m)",
    adminNoDeviceLocation: "Enhetens plats delades inte",
  },
  values: {
    status: {
      operational: "I drift",
      "not-operational": "Ur drift",
      "temporarily-unavailable": "Tillfälligt otillgänglig",
      planned: "Planerad",
      "partly-operational": "Delvis i drift",
      "in-use": "Upptagen",
      removed: "Borttagen",
    },
    trustFactors: {
      location: "Plats",
      chargerPhoto: "Foto av laddstationen",
      receiptPhoto: "Foto av kvitto",
      approvedBefore: "Godkänd tidigare",
      rejectedBefore: "Avvisad tidigare",
      accountAge: "Kontots ålder",
      signIns: "Inloggningar",
      favorites: "Favoriter",
    },
  },
};

export { adminChargerReports };
