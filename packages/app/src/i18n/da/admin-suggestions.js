// Danish: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Foreslåede ladestandere",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Afventer",
    adminSuggestionsAll: "Alle",
    adminSuggestionsApproved: "Godkendt",
    adminSuggestionsRejected: "Afvist",
    adminApproveSuggestion: "Godkend og tilføj",
    adminRejectSuggestion: "Afvis",
    adminProofPhoto: "Dokumentationsfoto af ladestanderen",
  },
  messages: {
    adminSuggestionsNotLoaded: "Forslagene til ladestandere kunne ikke indlæses. Prøv igen.",
    adminNoSuggestions: "Ingen forslag til ladestandere fundet.",
    adminSuggestionCount: {
      one: "{count} forslag til ladestander",
      other: "{count} forslag til ladestandere",
    },
    adminSuggestionPending: "Afventer",
    adminSuggestionApproved: "Godkendt",
    adminSuggestionRejected: "Afvist",
    adminSuggestedBy: "Foreslået af {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Type 2)",
      ccs1: "CCS (Type 1)",
      "type2-socket": "Type 2 (stikkontakt)",
      "type2-tethered": "Type 2 (fast kabel)",
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
