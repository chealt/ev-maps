// Danish: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Seneste 24 timer",
    adminPerformance: "Ydeevne",
    adminPerformanceDescription:
      "hvor hurtige sider og forespørgsler er, helt ned til databaseforespørgslerne",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "75. percentil af det, de besøgendes browsere målte; farven er Googles vurdering af det.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 pr. dag, over 14 dage",
    adminVitalTrendPick: "Web Vital til diagrammet",
    adminPerformanceRequests: "Forespørgsler i Workeren",
    adminPerformancePageRequests: "API-kald, som siden så dem",
    adminPerformanceQueries: "Langsomste databaseforespørgsler",
    adminRequestColumn: "Forespørgsel",
    adminQueryColumn: "Databaseforespørgsel",
    adminMaxColumn: "Maks.",
    adminErrorsColumn: "Fejl",
    adminSlowestRequests: "Langsomste forespørgsler",
    adminPathColumn: "Sti",
    adminDurationColumn: "Varighed",
    adminWhenColumn: "Hvornår",
    adminAllPerformance: "Al ydeevne",
    adminTraceSpans: "Sporets spans",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "ingen målinger",
    adminPerformancePeriod: {
      one: "Den seneste {count} dag",
      other: "De seneste {count} dage",
    },
    adminPerformanceNotLoaded: "Ydeevnen kunne ikke indlæses. Prøv igen.",
    adminMeasurements: {
      one: "{count} måling",
      other: "{count} målinger",
    },
    adminTraceNotFound: "Dette spor gemmes ikke længere.",
    adminTraceSummary: {
      one: "{duration}, {count} span, {time}",
      other: "{duration}, {count} spans, {time}",
    },
  },
};

export { adminPerformance };
