// Polski: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js.

const adminChargerReports = {
  page: {
    adminChargerReports: "Zgłoszone zmiany",
    adminApproveReport: "Zatwierdź",
    adminTrust: "Wiarygodność",
    adminTrustFactors: "Na czym opiera się wiarygodność",
    adminReportedAvailability: "Dostępność",
    adminReportedPrice: "Cena",
    adminReceiptPhoto: "Zdjęcie paragonu, faktury lub aplikacji do ładowania",
  },
  messages: {
    adminReportsNotLoaded: "Nie udało się wczytać zgłoszonych zmian. Spróbuj ponownie.",
    adminNoChargerReports: "Brak zgłoszonych zmian.",
    adminChargerReportCount: {
      one: "{count} zgłoszona zmiana",
      few: "{count} zgłoszone zmiany",
      many: "{count} zgłoszonych zmian",
      other: "{count} zgłoszonej zmiany",
    },
    adminReportedBy: "Zgłoszone przez {email}, {date}",
    adminChargerPhoto: "Zdjęcie ładowarki",
    adminReceiptPhoto: "Zdjęcie paragonu, faktury lub aplikacji do ładowania",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Bezpłatna",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} za sesję",
    adminDeviceDistance: "Urządzenie było {distance} m od ładowarki",
    adminDeviceDistanceAccuracy: "Urządzenie było {distance} m od ładowarki (±{accuracy} m)",
    adminNoDeviceLocation: "Lokalizacja urządzenia nie została udostępniona",
  },
  values: {
    status: {
      operational: "Działa",
      "not-operational": "Nie działa",
      "temporarily-unavailable": "Tymczasowo niedostępna",
      planned: "Planowana",
      "partly-operational": "Działa częściowo",
      "in-use": "W użyciu",
      removed: "Usunięta",
    },
    trustFactors: {
      location: "Lokalizacja",
      chargerPhoto: "Zdjęcie ładowarki",
      receiptPhoto: "Zdjęcie paragonu",
      approvedBefore: "Wcześniej zatwierdzone",
      rejectedBefore: "Wcześniej odrzucone",
      accountAge: "Wiek konta",
      signIns: "Logowania",
      favorites: "Ulubione",
    },
  },
};

export { adminChargerReports };
