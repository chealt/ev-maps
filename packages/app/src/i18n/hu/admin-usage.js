// Magyar: the admin area's usage page. See ../index.js for how
// the sections are put together and which pages get which.

const adminUsage = {
  page: {
    adminPeriod: "Időszak",
    adminLastDays: "Elmúlt {days} nap",
    adminPageViewsPerDay: "Oldalmegtekintések naponta",
    adminNoData: "Még nincs adat.",
  },
  messages: {
    adminUsageNotLoaded: "Nem sikerült betölteni a statisztikát. Próbáld újra.",
    adminUsagePeriod: "{from} – {to}",
    adminDayCount: "{day}: {count}",
  },
  values: {
    usageEvents: {
      page_view: "Oldalmegtekintések",
      visitor_country: "Látogatók országai",
      charger_opened: "Megnyitott töltők",
      filter_used: "Használt szűrők",
      locate_me: "Helymeghatározás",
      list_opened: "Megnyitott töltőlista",
      sign_in_started: "Bejelentkezési kísérletek",
      sign_up: "Regisztrációk",
      sign_in: "Bejelentkezések",
      route_planned: "Tervezett útvonalak",
      favorite_added: "Hozzáadott kedvencek",
    },
    pageKinds: {
      home: "kezdőlap",
      country: "országoldal",
      legal: "jogi oldal",
    },
    chargerSources: {
      ocm: "Open Charge Map",
      osm: "OpenStreetMap",
      eipa: "EIPA (Lengyelország)",
      irve: "IRVE (Franciaország)",
    },
    filterKinds: {
      power: "Töltési teljesítmény",
      connector: "Csatlakozótípus",
      operator: "Üzemeltető",
      favorites: "Csak a kedvencek",
      nearby: "Közeli helyek",
    },
    signInMethods: {
      google: "Google",
      github: "GitHub",
      microsoft: "Microsoft",
      apple: "Apple",
      passkey: "Jelkulcs",
      email: "E-mail-link",
    },
  },
};

export { adminUsage };
