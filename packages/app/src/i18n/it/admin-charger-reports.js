// Italian: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Modifiche segnalate",
    adminApproveReport: "Approva",
    adminTrust: "Affidabilità",
    adminTrustFactors: "Su cosa si basa l'affidabilità",
    adminReportedAvailability: "Disponibilità",
    adminReportedPrice: "Prezzo",
    adminReceiptPhoto: "Foto della ricevuta, fattura o app di ricarica",
  },
  messages: {
    adminReportsNotLoaded: "Impossibile caricare le modifiche segnalate. Riprovi.",
    adminNoChargerReports: "Nessuna modifica segnalata trovata.",
    adminChargerReportCount: {
      one: "{count} modifica segnalata",
      other: "{count} modifiche segnalate",
    },
    adminReportedBy: "Segnalato da {email} il {date}",
    adminChargerPhoto: "Foto della colonnina",
    adminReceiptPhoto: "Foto della ricevuta, fattura o app di ricarica",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratuito",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} a sessione",
    adminDeviceDistance: "Il dispositivo era a {distance} m dalla colonnina",
    adminDeviceDistanceAccuracy:
      "Il dispositivo era a {distance} m dalla colonnina (±{accuracy} m)",
    adminNoDeviceLocation: "La posizione del dispositivo non è stata condivisa",
  },
  values: {
    status: {
      operational: "In funzione",
      "not-operational": "Non in funzione",
      "temporarily-unavailable": "Temporaneamente non disponibile",
      planned: "Pianificata",
      "partly-operational": "Parzialmente in funzione",
      "in-use": "In uso",
      removed: "Rimossa",
    },
    trustFactors: {
      location: "Posizione",
      chargerPhoto: "Foto della colonnina",
      receiptPhoto: "Foto della ricevuta",
      approvedBefore: "Approvazioni precedenti",
      rejectedBefore: "Rifiuti precedenti",
      accountAge: "Anzianità dell'account",
      signIns: "Accessi",
      favorites: "Preferiti",
    },
  },
};

export { adminChargerReports };
