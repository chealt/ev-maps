// Danish: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Rapporterede ændringer",
    adminApproveReport: "Godkend",
    adminTrust: "Tillid",
    adminTrustFactors: "Hvad tilliden bygger på",
    adminReportedAvailability: "Tilgængelighed",
    adminReportedPrice: "Pris",
    adminReceiptPhoto: "Foto af kvittering, faktura eller lade-app",
  },
  messages: {
    adminReportsNotLoaded: "De rapporterede ændringer kunne ikke indlæses. Prøv igen.",
    adminNoChargerReports: "Ingen rapporterede ændringer fundet.",
    adminChargerReportCount: {
      one: "{count} rapporteret ændring",
      other: "{count} rapporterede ændringer",
    },
    adminReportedBy: "Rapporteret af {email} den {date}",
    adminChargerPhoto: "Foto af ladestanderen",
    adminReceiptPhoto: "Foto af kvittering, faktura eller lade-app",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratis",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} pr. opladning",
    adminDeviceDistance: "Enheden var {distance} m fra ladestanderen",
    adminDeviceDistanceAccuracy: "Enheden var {distance} m fra ladestanderen (±{accuracy} m)",
    adminNoDeviceLocation: "Enhedens placering blev ikke delt",
  },
  values: {
    status: {
      operational: "I drift",
      "not-operational": "Ude af drift",
      "temporarily-unavailable": "Midlertidigt utilgængelig",
      planned: "Planlagt",
      "partly-operational": "Delvist i drift",
      "in-use": "I brug",
      removed: "Fjernet",
    },
    trustFactors: {
      location: "Placering",
      chargerPhoto: "Foto af ladestanderen",
      receiptPhoto: "Foto af kvittering",
      approvedBefore: "Godkendt før",
      rejectedBefore: "Afvist før",
      accountAge: "Kontoens alder",
      signIns: "Logins",
      favorites: "Favoritter",
    },
  },
};

export { adminChargerReports };
