// Spanish: the admin area's reported charger changes page, and the proof and
// trust score its reports and the suggested chargers show. See ../index.js
// for how the sections are put together and which pages get which.

const adminChargerReports = {
  page: {
    adminChargerReports: "Cambios notificados",
    adminApproveReport: "Aprobar",
    adminTrust: "Confianza",
    adminTrustFactors: "En qué se basa la confianza",
    adminReportedAvailability: "Disponibilidad",
    adminReportedPrice: "Precio",
    adminReceiptPhoto: "Foto del recibo, la factura o la app de carga",
  },
  messages: {
    adminReportsNotLoaded: "No se han podido cargar los cambios notificados. Inténtalo de nuevo.",
    adminNoChargerReports: "No se han encontrado cambios notificados.",
    adminChargerReportCount: {
      one: "{count} cambio notificado",
      other: "{count} cambios notificados",
    },
    adminReportedBy: "Notificado por {email} el {date}",
    adminChargerPhoto: "Foto del cargador",
    adminReceiptPhoto: "Foto del recibo, la factura o la app de carga",
    adminTrustScore: "{score}/100",
    adminTrustFactor: "{factor} {points}",
    adminChange: "{before} → {after}",
    adminPriceFree: "Gratis",
    adminPricePerKwh: "{amount}/kWh",
    adminPricePerMinute: "{amount}/min",
    adminPricePerSession: "{amount} por sesión",
    adminDeviceDistance: "El dispositivo estaba a {distance} m del cargador",
    adminDeviceDistanceAccuracy:
      "El dispositivo estaba a {distance} m del cargador (±{accuracy} m)",
    adminNoDeviceLocation: "No se compartió la ubicación del dispositivo",
  },
  values: {
    status: {
      operational: "En funcionamiento",
      "not-operational": "Fuera de servicio",
      "temporarily-unavailable": "No disponible temporalmente",
      planned: "Planificado",
      "partly-operational": "Funcionamiento parcial",
      "in-use": "En uso",
      removed: "Retirado",
    },
    trustFactors: {
      location: "Ubicación",
      chargerPhoto: "Foto del cargador",
      receiptPhoto: "Foto del recibo",
      approvedBefore: "Aprobados antes",
      rejectedBefore: "Rechazados antes",
      accountAge: "Antigüedad de la cuenta",
      signIns: "Inicios de sesión",
      favorites: "Favoritos",
    },
  },
};

export { adminChargerReports };
