// Spanish: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Cargadores sugeridos",
    adminSuggestionStatusFilter: "Estado",
    adminSuggestionsPending: "Pendientes",
    adminSuggestionsAll: "Todos",
    adminSuggestionsApproved: "Aprobados",
    adminSuggestionsRejected: "Rechazados",
    adminApproveSuggestion: "Aprobar y añadir",
    adminRejectSuggestion: "Rechazar",
    adminProofPhoto: "Foto de prueba del cargador",
  },
  messages: {
    adminSuggestionsNotLoaded:
      "No se han podido cargar las sugerencias de cargadores. Inténtalo de nuevo.",
    adminNoSuggestions: "No se han encontrado sugerencias de cargadores.",
    adminSuggestionCount: {
      one: "{count} sugerencia de cargador",
      other: "{count} sugerencias de cargadores",
    },
    adminSuggestionPending: "Pendiente",
    adminSuggestionApproved: "Aprobado",
    adminSuggestionRejected: "Rechazado",
    adminSuggestedBy: "Sugerido por {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Tipo 2)",
      ccs1: "CCS (Tipo 1)",
      "type2-socket": "Tipo 2 (toma)",
      "type2-tethered": "Tipo 2 (cable fijo)",
      type2: "Tipo 2",
      type1: "Tipo 1 (J1772)",
      chademo: "CHAdeMO",
      nacs: "NACS (Tesla)",
      "tesla-supercharger": "Tesla Supercharger",
      "tesla-destination": "Tesla Destination",
      schuko: "Schuko (Tipo F)",
    },
  },
};

export { adminSuggestions };
