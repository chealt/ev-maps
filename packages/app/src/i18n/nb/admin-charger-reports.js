// Norsk bokmål: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Rapporterte endringer",
    adminApproveReport: "Godkjenn",
    adminTrust: "Tillit",
    adminTrustFactors: "Hva tilliten bygger på",
    adminReportedAvailability: "Tilgjengelighet",
    adminReportedPrice: "Pris",
    adminReceiptPhoto: "Bilde av kvittering, faktura eller ladeapp",
  },
  messages: {
    adminReportsNotLoaded: "De rapporterte endringene kunne ikke lastes. Prøv igjen.",
    adminNoChargerReports: "Fant ingen rapporterte endringer.",
    adminChargerReportCount: {
      one: "{count} rapportert endring",
      other: "{count} rapporterte endringer",
    },
    adminReportedBy: "Rapportert av {email} den {date}",
    adminChargerPhoto: "Bilde av ladestasjonen",
    adminReceiptPhoto: "Bilde av kvittering, faktura eller ladeapp",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratis",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} per lading",
    adminDeviceDistance: "Enheten var {distance} m fra ladestasjonen",
    adminDeviceDistanceAccuracy: "Enheten var {distance} m fra ladestasjonen (±{accuracy} m)",
    adminNoDeviceLocation: "Enhetens posisjon ble ikke delt",
  },
  values: {
    status: {
      operational: "I drift",
      "not-operational": "Ute av drift",
      "temporarily-unavailable": "Midlertidig utilgjengelig",
      planned: "Planlagt",
      "partly-operational": "Delvis i drift",
      "in-use": "Opptatt",
      removed: "Fjernet",
    },
    trustFactors: {
      location: "Posisjon",
      chargerPhoto: "Bilde av ladestasjonen",
      receiptPhoto: "Bilde av kvittering",
      approvedBefore: "Godkjent tidligere",
      rejectedBefore: "Avvist tidligere",
      accountAge: "Kontoens alder",
      signIns: "Innlogginger",
      favorites: "Favoritter",
    },
  },
};

export { adminChargerReports };
