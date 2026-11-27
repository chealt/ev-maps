// Czech: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Navržené nabíječky",
    adminSuggestionStatusFilter: "Stav",
    adminSuggestionsPending: "Čekající",
    adminSuggestionsAll: "Všechny",
    adminSuggestionsApproved: "Schválené",
    adminSuggestionsRejected: "Zamítnuté",
    adminApproveSuggestion: "Schválit a přidat",
    adminRejectSuggestion: "Zamítnout",
    adminProofPhoto: "Fotografie nabíječky jako důkaz",
  },
  messages: {
    adminSuggestionsNotLoaded: "Návrhy nabíječek se nepodařilo načíst. Zkuste to znovu.",
    adminNoSuggestions: "Nenašly se žádné návrhy nabíječek.",
    adminSuggestionCount: {
      one: "{count} návrh nabíječky",
      few: "{count} návrhy nabíječek",
      other: "{count} návrhů nabíječek",
    },
    adminSuggestionPending: "Čeká",
    adminSuggestionApproved: "Schválen",
    adminSuggestionRejected: "Zamítnut",
    adminSuggestedBy: "Navrhl(a) {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Typ 2)",
      ccs1: "CCS (Typ 1)",
      "type2-socket": "Typ 2 (zásuvka)",
      "type2-tethered": "Typ 2 (pevný kabel)",
      type2: "Typ 2",
      type1: "Typ 1 (J1772)",
      chademo: "CHAdeMO",
      nacs: "NACS (Tesla)",
      "tesla-supercharger": "Tesla Supercharger",
      "tesla-destination": "Tesla Destination",
      schuko: "Schuko (Typ F)",
    },
  },
};

export { adminSuggestions };
