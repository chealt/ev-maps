// English: the admin area's charger suggestions page. See ../index.js for how
// the sections are put together and which pages get which.

const adminSuggestions = {
  page: {
    adminSuggestions: "Suggested chargers",
    adminSuggestionStatusFilter: "Status",
    adminSuggestionsPending: "Pending",
    adminSuggestionsAll: "All",
    adminSuggestionsApproved: "Approved",
    adminSuggestionsRejected: "Rejected",
    adminApproveSuggestion: "Approve & add",
    adminRejectSuggestion: "Reject",
    adminProofPhoto: "Charger proof photo",
  },
  messages: {
    adminSuggestionsNotLoaded: "The charger suggestions couldn't be loaded. Try again.",
    adminNoSuggestions: "No charger suggestions found.",
    adminSuggestionCount: {
      one: "{count} charger suggestion",
      other: "{count} charger suggestions",
    },
    adminSuggestionPending: "Pending",
    adminSuggestionApproved: "Approved",
    adminSuggestionRejected: "Rejected",
    adminSuggestedBy: "Suggested by {email}",
    connectorWithPower: "{type}: {quantity}× · {power} kW",
  },
  values: {
    connectors: {
      ccs2: "CCS (Type 2)",
      ccs1: "CCS (Type 1)",
      "type2-socket": "Type 2 (socket)",
      "type2-tethered": "Type 2 (tethered cable)",
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
