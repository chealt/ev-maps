// German: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Gemeldete Änderungen",
    adminApproveReport: "Annehmen",
    adminTrust: "Vertrauen",
    adminTrustFactors: "Worauf das Vertrauen beruht",
    adminReportedAvailability: "Verfügbarkeit",
    adminReportedPrice: "Preis",
    adminReceiptPhoto: "Foto von Beleg, Rechnung oder Lade-App",
  },
  messages: {
    adminReportsNotLoaded:
      "Die gemeldeten Änderungen konnten nicht geladen werden. Versuche es erneut.",
    adminNoChargerReports: "Keine gemeldeten Änderungen gefunden.",
    adminChargerReportCount: {
      one: "{count} gemeldete Änderung",
      other: "{count} gemeldete Änderungen",
    },
    adminReportedBy: "Gemeldet von {email} am {date}",
    adminChargerPhoto: "Foto der Ladestation",
    adminReceiptPhoto: "Foto von Beleg, Rechnung oder Lade-App",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Kostenlos",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/Min.",
    adminPricePerSession: "{amount} pro Ladevorgang",
    adminDeviceDistance: "Das Gerät war {distance} m von der Ladestation entfernt",
    adminDeviceDistanceAccuracy:
      "Das Gerät war {distance} m von der Ladestation entfernt (±{accuracy} m)",
    adminNoDeviceLocation: "Der Standort des Geräts wurde nicht geteilt",
  },
  values: {
    status: {
      operational: "In Betrieb",
      "not-operational": "Außer Betrieb",
      "temporarily-unavailable": "Vorübergehend nicht verfügbar",
      planned: "Geplant",
      "partly-operational": "Teilweise in Betrieb",
      "in-use": "Belegt",
      removed: "Entfernt",
    },
    trustFactors: {
      location: "Standort",
      chargerPhoto: "Foto der Ladestation",
      receiptPhoto: "Belegfoto",
      approvedBefore: "Früher angenommen",
      rejectedBefore: "Früher abgelehnt",
      accountAge: "Alter des Kontos",
      signIns: "Anmeldungen",
      favorites: "Favoriten",
    },
  },
};

export { adminChargerReports };
