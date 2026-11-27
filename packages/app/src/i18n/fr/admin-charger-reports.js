// Français: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Modifications signalées",
    adminApproveReport: "Approuver",
    adminTrust: "Confiance",
    adminTrustFactors: "Sur quoi repose la confiance",
    adminReportedAvailability: "Disponibilité",
    adminReportedPrice: "Prix",
    adminReceiptPhoto: "Photo du reçu, de la facture ou de l'appli de recharge",
  },
  messages: {
    adminReportsNotLoaded: "Les modifications signalées n'ont pas pu être chargées. Réessaie.",
    adminNoChargerReports: "Aucune modification signalée trouvée.",
    adminChargerReportCount: {
      one: "{count} modification signalée",
      other: "{count} modifications signalées",
    },
    adminReportedBy: "Signalée par {email} le {date}",
    adminChargerPhoto: "Photo de la borne",
    adminReceiptPhoto: "Photo du reçu, de la facture ou de l'appli de recharge",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratuit",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} par session",
    adminDeviceDistance: "L'appareil était à {distance} m de la borne",
    adminDeviceDistanceAccuracy: "L'appareil était à {distance} m de la borne (±{accuracy} m)",
    adminNoDeviceLocation: "La position de l'appareil n'a pas été partagée",
  },
  values: {
    status: {
      operational: "En service",
      "not-operational": "Hors service",
      "temporarily-unavailable": "Temporairement indisponible",
      planned: "Prévue",
      "partly-operational": "Partiellement en service",
      "in-use": "Occupée",
      removed: "Supprimée",
    },
    trustFactors: {
      location: "Position",
      chargerPhoto: "Photo de la borne",
      receiptPhoto: "Photo du reçu",
      approvedBefore: "Déjà approuvé",
      rejectedBefore: "Déjà refusé",
      accountAge: "Ancienneté du compte",
      signIns: "Connexions",
      favorites: "Favoris",
    },
  },
};

export { adminChargerReports };
