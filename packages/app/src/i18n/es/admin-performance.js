// Spanish: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Últimas 24 horas",
    adminPerformance: "Rendimiento",
    adminPerformanceDescription:
      "lo rápidas que son las páginas y las solicitudes, hasta las consultas a la base de datos",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "El percentil 75 de lo que midieron los navegadores de los visitantes; el color es la valoración de Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 por día, durante 14 días",
    adminVitalTrendPick: "Web Vital que mostrar",
    adminPerformanceRequests: "Solicitudes, en el Worker",
    adminPerformancePageRequests: "Llamadas a la API, vistas desde la página",
    adminPerformanceQueries: "Consultas a la base de datos más lentas",
    adminRequestColumn: "Solicitud",
    adminQueryColumn: "Consulta",
    adminMaxColumn: "Máx.",
    adminErrorsColumn: "Errores",
    adminSlowestRequests: "Solicitudes más lentas",
    adminPathColumn: "Ruta",
    adminDurationColumn: "Duración",
    adminWhenColumn: "Cuándo",
    adminAllPerformance: "Todo el rendimiento",
    adminTraceSpans: "Tramos de la traza",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "sin mediciones",
    adminPerformanceNotLoaded: "No se ha podido cargar el rendimiento. Inténtalo de nuevo.",
    adminPerformancePeriod: {
      one: "El último {count} día",
      other: "Los últimos {count} días",
    },
    adminMeasurements: {
      one: "{count} medición",
      other: "{count} mediciones",
    },
    adminTraceNotFound: "Esta traza ya no se conserva.",
    adminTraceSummary: {
      one: "{duration}, {count} tramo, {time}",
      other: "{duration}, {count} tramos, {time}",
    },
  },
};

export { adminPerformance };
