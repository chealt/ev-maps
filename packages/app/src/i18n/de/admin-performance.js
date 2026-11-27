// German: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Letzte 24 Stunden",
    adminPerformance: "Performance",
    adminPerformanceDescription:
      "wie schnell Seiten und Anfragen sind, bis hin zu den Datenbankabfragen",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "Das 75. Perzentil der Messungen in den Browsern der Besucher; die Farbe ist Googles Bewertung dafür.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 pro Tag, über 14 Tage",
    adminVitalTrendPick: "Web Vital für das Diagramm",
    adminPerformanceRequests: "Anfragen im Worker",
    adminPerformancePageRequests: "API-Aufrufe aus Sicht der Seite",
    adminPerformanceQueries: "Langsamste Datenbankabfragen",
    adminRequestColumn: "Anfrage",
    adminQueryColumn: "Abfrage",
    adminMaxColumn: "Max.",
    adminErrorsColumn: "Fehler",
    adminSlowestRequests: "Langsamste Anfragen",
    adminPathColumn: "Pfad",
    adminDurationColumn: "Dauer",
    adminWhenColumn: "Wann",
    adminAllPerformance: "Gesamte Performance",
    adminTraceSpans: "Spans des Traces",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "keine Messungen",
    adminPerformanceNotLoaded: "Die Performance konnte nicht geladen werden. Versuche es erneut.",
    adminPerformancePeriod: {
      one: "Der letzte Tag",
      other: "Die letzten {count} Tage",
    },
    adminMeasurements: {
      one: "{count} Messung",
      other: "{count} Messungen",
    },
    adminTraceNotFound: "Dieser Trace wird nicht mehr aufbewahrt.",
    adminTraceSummary: {
      one: "{duration}, {count} Span, {time}",
      other: "{duration}, {count} Spans, {time}",
    },
  },
};

export { adminPerformance };
