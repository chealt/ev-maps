// Norsk bokmål: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Siste 24 timer",
    adminPerformance: "Ytelse",
    adminPerformanceDescription:
      "hvor raske sidene og forespørslene er, helt ned til databasespørringene",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75. persentil av det besøkendes nettlesere målte; fargen er Googles vurdering av det.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 per dag, over 14 dager",
    adminVitalTrendPick: "Web Vital som skal vises",
    adminPerformanceRequests: "Forespørsler, i Workeren",
    adminPerformancePageRequests: "API-kall, slik siden så dem",
    adminPerformanceQueries: "Tregeste databasespørringer",
    adminRequestColumn: "Forespørsel",
    adminQueryColumn: "Spørring",
    adminMaxColumn: "Maks",
    adminErrorsColumn: "Feil",
    adminSlowestRequests: "Tregeste forespørsler",
    adminPathColumn: "Sti",
    adminDurationColumn: "Tok",
    adminWhenColumn: "Når",
    adminAllPerformance: "All ytelse",
    adminTraceSpans: "Sporets spenn",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "ingen målinger",
    adminPerformanceNotLoaded: "Ytelsen kunne ikke lastes. Prøv igjen.",
    adminPerformancePeriod: {
      one: "Den siste {count} dagen",
      other: "De siste {count} dagene",
    },
    adminMeasurements: {
      one: "{count} måling",
      other: "{count} målinger",
    },
    adminTraceNotFound: "Dette sporet er ikke lagret lenger.",
    adminTraceSummary: {
      one: "{duration}, {count} spenn, {time}",
      other: "{duration}, {count} spenn, {time}",
    },
  },
};

export { adminPerformance };
