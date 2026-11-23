// English: the admin area's usage page. See ../index.js for how
// the sections are put together and which pages get which.

const adminUsage = {
  page: {
    adminPeriod: "Period",
    adminLastDays: "Last {days} days",
    adminPageViewsPerDay: "Page views per day",
    adminNoData: "Nothing yet.",
    adminTopItems: "Most favorited chargers, now",
  },
  messages: {
    adminUsageNotLoaded: "The usage stats couldn't be loaded. Try again.",
    adminUsagePeriod: "{from} – {to}",
    adminTopCount: {
      one: "{count} user",
      other: "{count} users",
    },
  },
  values: {
    usageEvents: {
      page_view: "Page views",
      visitor_country: "Visitors' countries",
      charger_opened: "Chargers opened",
      filter_used: "Filters used",
      locate_me: "Locate me",
      list_opened: "Charger list opened",
      sign_in_started: "Sign-in attempts",
      sign_up: "Sign-ups",
      sign_in: "Sign-ins",
      route_planned: "Routes planned",
      favorite_added: "Favorites added",
    },
    pageKinds: {
      home: "home page",
      country: "country page",
      legal: "legal page",
    },
    chargerSources: {
      ocm: "Open Charge Map",
      osm: "OpenStreetMap",
      eipa: "EIPA (Poland)",
      irve: "IRVE (France)",
    },
    filterKinds: {
      power: "Charging power",
      connector: "Connector type",
      operator: "Operator",
      favorites: "Only favorites",
      nearby: "Nearby places",
    },
    signInMethods: {
      google: "Google",
      github: "GitHub",
      microsoft: "Microsoft",
      apple: "Apple",
      passkey: "Passkey",
      email: "Email link",
    },
  },
};

export { adminUsage };
