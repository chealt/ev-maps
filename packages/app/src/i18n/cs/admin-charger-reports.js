// Czech: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Nahlášené změny",
    adminApproveReport: "Schválit",
    adminTrust: "Důvěryhodnost",
    adminTrustFactors: "Na čem je důvěryhodnost založena",
    adminReportedAvailability: "Dostupnost",
    adminReportedPrice: "Cena",
    adminReceiptPhoto: "Fotografie účtenky, faktury nebo nabíjecí aplikace",
  },
  messages: {
    adminReportsNotLoaded: "Nahlášené změny se nepodařilo načíst. Zkuste to znovu.",
    adminNoChargerReports: "Nenašly se žádné nahlášené změny.",
    adminChargerReportCount: {
      one: "{count} nahlášená změna",
      few: "{count} nahlášené změny",
      other: "{count} nahlášených změn",
    },
    adminReportedBy: "Nahlásil(a) {email} dne {date}",
    adminChargerPhoto: "Fotografie nabíječky",
    adminReceiptPhoto: "Fotografie účtenky, faktury nebo nabíjecí aplikace",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Zdarma",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} za nabíjení",
    adminDeviceDistance: "Zařízení bylo {distance} m od nabíječky",
    adminDeviceDistanceAccuracy: "Zařízení bylo {distance} m od nabíječky (±{accuracy} m)",
    adminNoDeviceLocation: "Poloha zařízení nebyla sdílena",
  },
  values: {
    status: {
      operational: "V provozu",
      "not-operational": "Mimo provoz",
      "temporarily-unavailable": "Dočasně nedostupná",
      planned: "Plánovaná",
      "partly-operational": "Částečně v provozu",
      "in-use": "Používá se",
      removed: "Odstraněná",
    },
    trustFactors: {
      location: "Poloha",
      chargerPhoto: "Fotografie nabíječky",
      receiptPhoto: "Fotografie účtenky",
      approvedBefore: "Dříve schváleno",
      rejectedBefore: "Dříve zamítnuto",
      accountAge: "Stáří účtu",
      signIns: "Přihlášení",
      favorites: "Oblíbené",
    },
  },
};

export { adminChargerReports };
