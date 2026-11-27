// Italian: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Colonnine suggerite",
    adminSuggestionStatusFilter: "Stato",
    adminSuggestionsPending: "In attesa",
    adminSuggestionsAll: "Tutte",
    adminSuggestionsApproved: "Approvate",
    adminSuggestionsRejected: "Rifiutate",
    adminApproveSuggestion: "Approva e aggiungi",
    adminRejectSuggestion: "Rifiuta",
    adminProofPhoto: "Foto di prova della colonnina",
  },
  messages: {
    adminSuggestionsNotLoaded: "Impossibile caricare i suggerimenti di colonnine. Riprovi.",
    adminNoSuggestions: "Nessun suggerimento di colonnine trovato.",
    adminSuggestionCount: {
      one: "{count} suggerimento di colonnina",
      other: "{count} suggerimenti di colonnine",
    },
    adminSuggestionPending: "In attesa",
    adminSuggestionApproved: "Approvato",
    adminSuggestionRejected: "Rifiutato",
    adminSuggestedBy: "Suggerito da {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Tipo 2)",
      ccs1: "CCS (Tipo 1)",
      "type2-socket": "Tipo 2 (presa)",
      "type2-tethered": "Tipo 2 (cavo fisso)",
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
