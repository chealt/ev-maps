// Français: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Bornes suggérées",
    adminSuggestionStatusFilter: "Statut",
    adminSuggestionsPending: "En attente",
    adminSuggestionsAll: "Toutes",
    adminSuggestionsApproved: "Approuvées",
    adminSuggestionsRejected: "Refusées",
    adminApproveSuggestion: "Approuver et ajouter",
    adminRejectSuggestion: "Refuser",
    adminProofPhoto: "Photo justificative de la borne",
  },
  messages: {
    adminSuggestionsNotLoaded: "Les suggestions de bornes n'ont pas pu être chargées. Réessaie.",
    adminNoSuggestions: "Aucune suggestion de borne trouvée.",
    adminSuggestionCount: {
      one: "{count} suggestion de borne",
      other: "{count} suggestions de bornes",
    },
    adminSuggestionPending: "En attente",
    adminSuggestionApproved: "Approuvée",
    adminSuggestionRejected: "Refusée",
    adminSuggestedBy: "Suggérée par {email}",
    connectorWithPower: "{type} : {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Type 2)",
      ccs1: "CCS (Type 1)",
      "type2-socket": "Type 2 (prise)",
      "type2-tethered": "Type 2 (câble attaché)",
      type2: "Type 2",
      type1: "Type 1 (J1772)",
      chademo: "CHAdeMO",
      nacs: "NACS (Tesla)",
      "tesla-supercharger": "Tesla Supercharger",
      "tesla-destination": "Tesla Destination",
      schuko: "Schuko (Type F)",
    },
  },
};

export { adminSuggestions };
