// Polski: the admin area's usage page. See ../index.js for how
// the sections are put together and which pages get which.

const adminUsage = {
  page: {
    adminPeriod: "Okres",
    adminLastDays: "Ostatnie {days} dni",
    adminPageViewsPerDay: "Wyświetlenia stron dziennie",
    adminNoData: "Jeszcze nic.",
  },
  messages: {
    adminUsageNotLoaded: "Nie udało się wczytać statystyk. Spróbuj ponownie.",
    adminUsagePeriod: "{from} – {to}",
  },
  values: {
    usageEvents: {
      page_view: "Wyświetlenia stron",
      visitor_country: "Kraje odwiedzających",
      charger_opened: "Otwarte stacje",
      filter_used: "Użyte filtry",
      locate_me: "Zlokalizuj mnie",
      list_opened: "Otwarta lista stacji",
      sign_in_started: "Próby logowania",
      sign_up: "Rejestracje",
      sign_in: "Logowania",
      route_planned: "Zaplanowane trasy",
      favorite_added: "Dodane ulubione",
    },
    pageKinds: {
      home: "strona główna",
      country: "strona kraju",
      legal: "strona prawna",
    },
    chargerSources: {
      ocm: "Open Charge Map",
      osm: "OpenStreetMap",
      eipa: "EIPA (Polska)",
      irve: "IRVE (Francja)",
    },
    filterKinds: {
      power: "Moc ładowania",
      connector: "Typ złącza",
      operator: "Operator",
      favorites: "Tylko ulubione",
      nearby: "Miejsca w pobliżu",
    },
    signInMethods: {
      google: "Google",
      github: "GitHub",
      microsoft: "Microsoft",
      apple: "Apple",
      passkey: "Klucz dostępu",
      email: "Link e-mail",
    },
  },
};

export { adminUsage };
