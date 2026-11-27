// Swedish: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Föreslagna laddstationer",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Väntande",
    adminSuggestionsAll: "Alla",
    adminSuggestionsApproved: "Godkända",
    adminSuggestionsRejected: "Avvisade",
    adminApproveSuggestion: "Godkänn och lägg till",
    adminRejectSuggestion: "Avvisa",
    adminProofPhoto: "Bevisfoto av laddstationen",
  },
  messages: {
    adminSuggestionsNotLoaded: "Förslagen på laddstationer kunde inte laddas. Försök igen.",
    adminNoSuggestions: "Inga förslag på laddstationer hittades.",
    adminSuggestionCount: {
      one: "{count} förslag på laddstation",
      other: "{count} förslag på laddstationer",
    },
    adminSuggestionPending: "Väntande",
    adminSuggestionApproved: "Godkänd",
    adminSuggestionRejected: "Avvisad",
    adminSuggestedBy: "Föreslagen av {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (typ 2)",
      ccs1: "CCS (typ 1)",
      "type2-socket": "Typ 2 (uttag)",
      "type2-tethered": "Typ 2 (fast kabel)",
      type2: "Typ 2",
      type1: "Typ 1 (J1772)",
      chademo: "CHAdeMO",
      nacs: "NACS (Tesla)",
      "tesla-supercharger": "Tesla Supercharger",
      "tesla-destination": "Tesla Destination",
      schuko: "Schuko (typ F)",
    },
  },
};

export { adminSuggestions };
