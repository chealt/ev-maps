// Polski: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Ostatnie 24 godziny",
    adminPerformance: "Wydajność",
    adminPerformanceDescription: "jak szybko działają strony i zapytania, aż do bazy danych",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75. percentyl pomiarów z przeglądarek odwiedzających; kolor to ocena Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 dziennie, przez 14 dni",
    adminVitalTrendPick: "Web Vital na wykresie",
    adminPerformanceRequests: "Zapytania w Workerze",
    adminPerformancePageRequests: "Wywołania API widziane przez stronę",
    adminPerformanceQueries: "Najwolniejsze zapytania do bazy",
    adminRequestColumn: "Zapytanie",
    adminQueryColumn: "Zapytanie SQL",
    adminMaxColumn: "Maks.",
    adminErrorsColumn: "Błędy",
    adminSlowestRequests: "Najwolniejsze zapytania",
    adminPathColumn: "Ścieżka",
    adminDurationColumn: "Czas",
    adminWhenColumn: "Kiedy",
    adminAllPerformance: "Cała wydajność",
    adminTraceSpans: "Elementy śladu",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "brak pomiarów",
    adminPerformanceNotLoaded: "Nie udało się wczytać wydajności. Spróbuj ponownie.",
    adminPerformancePeriod: {
      one: "Ostatni {count} dzień",
      few: "Ostatnie {count} dni",
      many: "Ostatnie {count} dni",
      other: "Ostatnie dni: {count}",
    },
    adminMeasurements: {
      one: "{count} pomiar",
      few: "{count} pomiary",
      many: "{count} pomiarów",
      other: "Pomiary: {count}",
    },
    adminTraceNotFound: "Ten ślad nie jest już przechowywany.",
    adminTraceSummary: {
      one: "{duration}, {count} element, {time}",
      few: "{duration}, {count} elementy, {time}",
      many: "{duration}, {count} elementów, {time}",
      other: "{duration}, elementy: {count}, {time}",
    },
  },
};

export { adminPerformance };
