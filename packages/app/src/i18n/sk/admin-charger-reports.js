// Slovak: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Nahlásené zmeny",
    adminApproveReport: "Schváliť",
    adminTrust: "Dôveryhodnosť",
    adminTrustFactors: "Na čom je dôveryhodnosť založená",
    adminReportedAvailability: "Dostupnosť",
    adminReportedPrice: "Cena",
    adminReceiptPhoto: "Fotografia účtenky, faktúry alebo nabíjacej aplikácie",
  },
  messages: {
    adminReportsNotLoaded: "Nahlásené zmeny sa nepodarilo načítať. Skúste to znova.",
    adminNoChargerReports: "Nenašli sa žiadne nahlásené zmeny.",
    adminChargerReportCount: {
      one: "{count} nahlásená zmena",
      few: "{count} nahlásené zmeny",
      other: "{count} nahlásených zmien",
    },
    adminReportedBy: "Nahlásil(a) {email} dňa {date}",
    adminChargerPhoto: "Fotografia nabíjačky",
    adminReceiptPhoto: "Fotografia účtenky, faktúry alebo nabíjacej aplikácie",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Zadarmo",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} za nabíjanie",
    adminDeviceDistance: "Zariadenie bolo {distance} m od nabíjačky",
    adminDeviceDistanceAccuracy: "Zariadenie bolo {distance} m od nabíjačky (±{accuracy} m)",
    adminNoDeviceLocation: "Poloha zariadenia nebola zdieľaná",
  },
  values: {
    status: {
      operational: "V prevádzke",
      "not-operational": "Mimo prevádzky",
      "temporarily-unavailable": "Dočasne nedostupná",
      planned: "Plánovaná",
      "partly-operational": "Čiastočne v prevádzke",
      "in-use": "Používa sa",
      removed: "Odstránená",
    },
    trustFactors: {
      location: "Poloha",
      chargerPhoto: "Fotografia nabíjačky",
      receiptPhoto: "Fotografia účtenky",
      approvedBefore: "Predtým schválené",
      rejectedBefore: "Predtým zamietnuté",
      accountAge: "Vek účtu",
      signIns: "Prihlásenia",
      favorites: "Obľúbené",
    },
  },
};

export { adminChargerReports };
