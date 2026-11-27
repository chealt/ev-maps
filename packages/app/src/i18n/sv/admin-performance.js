// Swedish: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Senaste 24 timmarna",
    adminPerformance: "Prestanda",
    adminPerformanceDescription: "hur snabba sidor och anrop är, ner till databasfrågorna",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75:e percentilen av det besökarnas webbläsare mätte; färgen är Googles bedömning av den.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 per dag, under 14 dagar",
    adminVitalTrendPick: "Web Vital att visa i diagrammet",
    adminPerformanceRequests: "Anrop, i Workern",
    adminPerformancePageRequests: "API-anrop, som sidan såg dem",
    adminPerformanceQueries: "Långsammaste databasfrågorna",
    adminRequestColumn: "Anrop",
    adminQueryColumn: "Fråga",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Fel",
    adminSlowestRequests: "Långsammaste anropen",
    adminPathColumn: "Sökväg",
    adminDurationColumn: "Tog",
    adminWhenColumn: "När",
    adminAllPerformance: "All prestanda",
    adminTraceSpans: "Spårningens spann",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "inga mätningar",
    adminPerformanceNotLoaded: "Prestandan kunde inte laddas. Försök igen.",
    adminPerformancePeriod: {
      one: "Den senaste {count} dagen",
      other: "De senaste {count} dagarna",
    },
    adminMeasurements: {
      one: "{count} mätning",
      other: "{count} mätningar",
    },
    adminTraceNotFound: "Den här spårningen sparas inte längre.",
    adminTraceSummary: {
      one: "{duration}, {count} spann, {time}",
      other: "{duration}, {count} spann, {time}",
    },
  },
};

export { adminPerformance };
