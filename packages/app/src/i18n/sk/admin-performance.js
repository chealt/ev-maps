// Slovak: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Posledných 24 hodín",
    adminPerformance: "Výkon",
    adminPerformanceDescription: "ako rýchle sú stránky a požiadavky, až po databázové dopyty",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75. percentil toho, čo namerali prehliadače návštevníkov; farba je hodnotenie od Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 za deň, za 14 dní",
    adminVitalTrendPick: "Web Vital v grafe",
    adminPerformanceRequests: "Požiadavky vo Workeri",
    adminPerformancePageRequests: "Volania API, ako ich videla stránka",
    adminPerformanceQueries: "Najpomalšie databázové dopyty",
    adminRequestColumn: "Požiadavka",
    adminQueryColumn: "Dopyt",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Chyby",
    adminSlowestRequests: "Najpomalšie požiadavky",
    adminPathColumn: "Cesta",
    adminDurationColumn: "Trvanie",
    adminWhenColumn: "Kedy",
    adminAllPerformance: "Celý výkon",
    adminTraceSpans: "Úseky trasovania",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "žiadne merania",
    adminPerformanceNotLoaded: "Výkon sa nepodarilo načítať. Skúste to znova.",
    adminPerformancePeriod: {
      one: "Posledný {count} deň",
      few: "Posledné {count} dni",
      other: "Posledných {count} dní",
    },
    adminMeasurements: {
      one: "{count} meranie",
      few: "{count} merania",
      other: "{count} meraní",
    },
    adminTraceNotFound: "Toto trasovanie sa už neuchováva.",
    adminTraceSummary: {
      one: "{duration}, {count} úsek, {time}",
      few: "{duration}, {count} úseky, {time}",
      other: "{duration}, {count} úsekov, {time}",
    },
  },
};

export { adminPerformance };
