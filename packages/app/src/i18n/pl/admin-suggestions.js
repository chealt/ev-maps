// Polski: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Zgłoszone stacje",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Oczekujące",
    adminSuggestionsAll: "Wszystkie",
    adminSuggestionsApproved: "Zatwierdzone",
    adminSuggestionsRejected: "Odrzucone",
    adminApproveSuggestion: "Zatwierdź i dodaj",
    adminRejectSuggestion: "Odrzuć",
    adminProofPhoto: "Zdjęcie potwierdzające stację",
  },
  messages: {
    adminSuggestionsNotLoaded: "Nie udało się wczytać zgłoszonych stacji. Spróbuj ponownie.",
    adminNoSuggestions: "Brak zgłoszonych stacji.",
    adminSuggestionCount: {
      one: "{count} zgłoszona stacja",
      few: "{count} zgłoszone stacje",
      many: "{count} zgłoszonych stacji",
      other: "Zgłoszone stacje: {count}",
    },
    adminSuggestionPending: "Oczekujące",
    adminSuggestionApproved: "Zatwierdzone",
    adminSuggestionRejected: "Odrzucone",
    adminSuggestedBy: "Zgłoszone przez: {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Typ 2)",
      ccs1: "CCS (Typ 1)",
      "type2-socket": "Typ 2 (gniazdo)",
      "type2-tethered": "Typ 2 (z kablem)",
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
