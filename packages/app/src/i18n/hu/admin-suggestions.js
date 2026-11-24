// Magyar: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Javasolt töltők",
    adminSuggestionStatusFilter: "Állapot",
    adminSuggestionsPending: "Függőben",
    adminSuggestionsAll: "Mind",
    adminSuggestionsApproved: "Jóváhagyva",
    adminSuggestionsRejected: "Elutasítva",
    adminApproveSuggestion: "Jóváhagyás és hozzáadás",
    adminRejectSuggestion: "Elutasítás",
    adminProofPhoto: "Igazoló fénykép a töltőről",
  },
  messages: {
    adminSuggestionsNotLoaded: "Nem sikerült betölteni a javasolt töltőket. Próbáld újra.",
    adminNoSuggestions: "Nincs javasolt töltő.",
    adminSuggestionCount: {
      one: "{count} javasolt töltő",
      other: "{count} javasolt töltő",
    },
    adminSuggestionPending: "Függőben",
    adminSuggestionApproved: "Jóváhagyva",
    adminSuggestionRejected: "Elutasítva",
    adminSuggestedBy: "Javasolta: {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (2-es típus)",
      ccs1: "CCS (1-es típus)",
      "type2-socket": "2-es típus (aljzat)",
      "type2-tethered": "2-es típus (fix kábel)",
      type2: "2-es típus",
      type1: "1-es típus (J1772)",
      chademo: "CHAdeMO",
      nacs: "NACS (Tesla)",
      "tesla-supercharger": "Tesla Supercharger",
      "tesla-destination": "Tesla Destination",
      schuko: "Schuko (F típus)",
    },
  },
};

export { adminSuggestions };
