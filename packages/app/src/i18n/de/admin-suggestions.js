// German: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Vorgeschlagene Ladestationen",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Offen",
    adminSuggestionsAll: "Alle",
    adminSuggestionsApproved: "Angenommen",
    adminSuggestionsRejected: "Abgelehnt",
    adminApproveSuggestion: "Annehmen und hinzufügen",
    adminRejectSuggestion: "Ablehnen",
    adminProofPhoto: "Nachweisfoto der Ladestation",
  },
  messages: {
    adminSuggestionsNotLoaded:
      "Die Vorschläge für Ladestationen konnten nicht geladen werden. Versuche es erneut.",
    adminNoSuggestions: "Keine Vorschläge für Ladestationen gefunden.",
    adminSuggestionCount: {
      one: "{count} Vorschlag für eine Ladestation",
      other: "{count} Vorschläge für Ladestationen",
    },
    adminSuggestionPending: "Offen",
    adminSuggestionApproved: "Angenommen",
    adminSuggestionRejected: "Abgelehnt",
    adminSuggestedBy: "Vorgeschlagen von {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Typ 2)",
      ccs1: "CCS (Typ 1)",
      "type2-socket": "Typ 2 (Steckdose)",
      "type2-tethered": "Typ 2 (festes Kabel)",
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
