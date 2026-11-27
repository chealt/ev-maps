// Slovak: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Navrhnuté nabíjačky",
    adminSuggestionStatusFilter: "Stav",
    adminSuggestionsPending: "Čakajúce",
    adminSuggestionsAll: "Všetky",
    adminSuggestionsApproved: "Schválené",
    adminSuggestionsRejected: "Zamietnuté",
    adminApproveSuggestion: "Schváliť a pridať",
    adminRejectSuggestion: "Zamietnuť",
    adminProofPhoto: "Fotografia nabíjačky ako dôkaz",
  },
  messages: {
    adminSuggestionsNotLoaded: "Návrhy nabíjačiek sa nepodarilo načítať. Skúste to znova.",
    adminNoSuggestions: "Nenašli sa žiadne návrhy nabíjačiek.",
    adminSuggestionCount: {
      one: "{count} návrh nabíjačky",
      few: "{count} návrhy nabíjačiek",
      other: "{count} návrhov nabíjačiek",
    },
    adminSuggestionPending: "Čaká",
    adminSuggestionApproved: "Schválený",
    adminSuggestionRejected: "Zamietnutý",
    adminSuggestedBy: "Navrhol(a) {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Typ 2)",
      ccs1: "CCS (Typ 1)",
      "type2-socket": "Typ 2 (zásuvka)",
      "type2-tethered": "Typ 2 (pevný kábel)",
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
