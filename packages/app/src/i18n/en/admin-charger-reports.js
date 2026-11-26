// English: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Reported changes",
    adminApproveReport: "Approve",
    adminTrust: "Trust",
    adminTrustFactors: "What the trust is based on",
    adminReportedAvailability: "Availability",
    adminReportedPrice: "Price",
    adminReceiptPhoto: "Receipt, invoice or charging app photo",
  },
  messages: {
    adminReportsNotLoaded: "The reported changes couldn't be loaded. Try again.",
    adminNoChargerReports: "No reported changes found.",
    adminChargerReportCount: {
      one: "{count} reported change",
      other: "{count} reported changes",
    },
    adminReportedBy: "Reported by {email} on {date}",
    adminChargerPhoto: "Charger photo",
    adminReceiptPhoto: "Receipt, invoice or charging app photo",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Free",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} per session",
    adminDeviceDistance: "The device was {distance} m from the charger",
    adminDeviceDistanceAccuracy: "The device was {distance} m from the charger (±{accuracy} m)",
    adminNoDeviceLocation: "The device's location wasn't shared",
  },
  values: {
    status: {
      operational: "Operational",
      "not-operational": "Not operational",
      "temporarily-unavailable": "Temporarily unavailable",
      planned: "Planned",
      "partly-operational": "Partly operational",
      "in-use": "In use",
      removed: "Removed",
    },
    trustFactors: {
      location: "Location",
      chargerPhoto: "Charger photo",
      receiptPhoto: "Receipt photo",
      approvedBefore: "Approved before",
      rejectedBefore: "Rejected before",
      accountAge: "Account age",
      signIns: "Sign-ins",
      favorites: "Favorites",
    },
  },
};

export { adminChargerReports };
