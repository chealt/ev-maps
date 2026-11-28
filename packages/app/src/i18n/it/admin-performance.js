// Italian: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Ultime 24 ore",
    adminPerformance: "Prestazioni",
    adminPerformanceDescription:
      "quanto sono veloci le pagine e le richieste, fino alle query del database",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "Il 75° percentile di quanto misurato dai browser dei visitatori; il colore è la valutazione di Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 al giorno, su 14 giorni",
    adminVitalTrendPick: "Web Vital da rappresentare",
    adminPerformanceRequests: "Richieste, nel Worker",
    adminPerformancePageRequests: "Chiamate API, viste dalla pagina",
    adminPerformanceQueries: "Query del database più lente",
    adminRequestColumn: "Richiesta",
    adminQueryColumn: "Query",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Errori",
    adminSlowestRequests: "Richieste più lente",
    adminPathColumn: "Percorso",
    adminDurationColumn: "Durata",
    adminWhenColumn: "Quando",
    adminAllPerformance: "Tutte le prestazioni",
    adminTraceSpans: "Span della traccia",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "nessuna misurazione",
    adminPerformanceNotLoaded: "Impossibile caricare le prestazioni. Riprovi.",
    adminPerformancePeriod: {
      one: "L'ultimo {count} giorno",
      other: "Gli ultimi {count} giorni",
    },
    adminMeasurements: {
      one: "{count} misurazione",
      other: "{count} misurazioni",
    },
    adminTraceNotFound: "Questa traccia non è più conservata.",
    adminTraceSummary: {
      one: "{duration}, {count} span, {time}",
      other: "{duration}, {count} span, {time}",
    },
  },
};

export { adminPerformance };
