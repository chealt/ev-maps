// Magyar: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js.

const adminChargerReports = {
  page: {
    adminChargerReports: "Bejelentett változások",
    adminApproveReport: "Jóváhagyás",
    adminTrust: "Megbízhatóság",
    adminTrustFactors: "Amin a megbízhatóság alapul",
    adminReportedAvailability: "Elérhetőség",
    adminReportedPrice: "Ár",
    adminReceiptPhoto: "Fénykép a nyugtáról, számláról vagy töltőappról",
  },
  messages: {
    adminReportsNotLoaded: "Nem sikerült betölteni a bejelentett változásokat. Próbáld újra.",
    adminNoChargerReports: "Nincs bejelentett változás.",
    adminChargerReportCount: {
      one: "{count} bejelentett változás",
      other: "{count} bejelentett változás",
    },
    adminReportedBy: "Bejelentette: {email}, {date}",
    adminChargerPhoto: "Fénykép a töltőről",
    adminReceiptPhoto: "Fénykép a nyugtáról, számláról vagy töltőappról",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Ingyenes",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/perc",
    adminPricePerSession: "{amount} alkalmanként",
    adminDeviceDistance: "Az eszköz {distance} m-re volt a töltőtől",
    adminDeviceDistanceAccuracy: "Az eszköz {distance} m-re volt a töltőtől (±{accuracy} m)",
    adminNoDeviceLocation: "Az eszköz helyét nem osztották meg",
  },
  values: {
    status: {
      operational: "Működik",
      "not-operational": "Nem működik",
      "temporarily-unavailable": "Átmenetileg nem elérhető",
      planned: "Tervezett",
      "partly-operational": "Részben működik",
      "in-use": "Használatban",
      removed: "Megszűnt",
    },
    trustFactors: {
      location: "Hely",
      chargerPhoto: "Fénykép a töltőről",
      receiptPhoto: "Fénykép a nyugtáról",
      approvedBefore: "Korábban jóváhagyva",
      rejectedBefore: "Korábban elutasítva",
      accountAge: "Fiók kora",
      signIns: "Bejelentkezések",
      favorites: "Kedvencek",
    },
  },
};

export { adminChargerReports };
