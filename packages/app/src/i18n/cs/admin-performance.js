// Czech: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Posledních 24 hodin",
    adminPerformance: "Výkon",
    adminPerformanceDescription: "jak rychlé jsou stránky a požadavky, až po databázové dotazy",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75. percentil toho, co naměřily prohlížeče návštěvníků; barva je hodnocení od Googlu.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 za den, za 14 dní",
    adminVitalTrendPick: "Web Vital v grafu",
    adminPerformanceRequests: "Požadavky ve Workeru",
    adminPerformancePageRequests: "Volání API, jak je viděla stránka",
    adminPerformanceQueries: "Nejpomalejší databázové dotazy",
    adminRequestColumn: "Požadavek",
    adminQueryColumn: "Dotaz",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Chyby",
    adminSlowestRequests: "Nejpomalejší požadavky",
    adminPathColumn: "Cesta",
    adminDurationColumn: "Trvání",
    adminWhenColumn: "Kdy",
    adminAllPerformance: "Celý výkon",
    adminTraceSpans: "Úseky trasování",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "žádná měření",
    adminPerformanceNotLoaded: "Výkon se nepodařilo načíst. Zkuste to znovu.",
    adminPerformancePeriod: {
      one: "Poslední {count} den",
      few: "Poslední {count} dny",
      other: "Posledních {count} dní",
    },
    adminMeasurements: {
      one: "{count} měření",
      few: "{count} měření",
      other: "{count} měření",
    },
    adminTraceNotFound: "Toto trasování se již neuchovává.",
    adminTraceSummary: {
      one: "{duration}, {count} úsek, {time}",
      few: "{duration}, {count} úseky, {time}",
      other: "{duration}, {count} úseků, {time}",
    },
  },
};

export { adminPerformance };
