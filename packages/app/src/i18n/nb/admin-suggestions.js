// Norsk bokmål: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Foreslåtte ladestasjoner",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Venter",
    adminSuggestionsAll: "Alle",
    adminSuggestionsApproved: "Godkjent",
    adminSuggestionsRejected: "Avvist",
    adminApproveSuggestion: "Godkjenn og legg til",
    adminRejectSuggestion: "Avvis",
    adminProofPhoto: "Bildebevis av ladestasjonen",
  },
  messages: {
    adminSuggestionsNotLoaded: "Forslagene til ladestasjoner kunne ikke lastes. Prøv igjen.",
    adminNoSuggestions: "Fant ingen forslag til ladestasjoner.",
    adminSuggestionCount: {
      one: "{count} forslag til ladestasjon",
      other: "{count} forslag til ladestasjoner",
    },
    adminSuggestionPending: "Venter",
    adminSuggestionApproved: "Godkjent",
    adminSuggestionRejected: "Avvist",
    adminSuggestedBy: "Foreslått av {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Type 2)",
      ccs1: "CCS (Type 1)",
      "type2-socket": "Type 2 (kontakt)",
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
