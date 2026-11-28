// Portuguese: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Carregadores sugeridos",
    adminSuggestionStatusFilter: "Estado",
    adminSuggestionsPending: "Pendentes",
    adminSuggestionsAll: "Todos",
    adminSuggestionsApproved: "Aprovados",
    adminSuggestionsRejected: "Rejeitados",
    adminApproveSuggestion: "Aprovar e adicionar",
    adminRejectSuggestion: "Rejeitar",
    adminProofPhoto: "Fotografia comprovativa do carregador",
  },
  messages: {
    adminSuggestionsNotLoaded:
      "Não foi possível carregar as sugestões de carregadores. Tente novamente.",
    adminNoSuggestions: "Não foram encontradas sugestões de carregadores.",
    adminSuggestionCount: {
      one: "{count} sugestão de carregador",
      other: "{count} sugestões de carregadores",
    },
    adminSuggestionPending: "Pendente",
    adminSuggestionApproved: "Aprovada",
    adminSuggestionRejected: "Rejeitada",
    adminSuggestedBy: "Sugerido por {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Tipo 2)",
      ccs1: "CCS (Tipo 1)",
      "type2-socket": "Tipo 2 (tomada)",
      "type2-tethered": "Tipo 2 (cabo fixo)",
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
