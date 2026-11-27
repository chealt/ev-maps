// Portuguese: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Últimas 24 horas",
    adminPerformance: "Desempenho",
    adminPerformanceDescription:
      "a rapidez das páginas e dos pedidos, até às consultas à base de dados",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "O percentil 75 do que os navegadores dos visitantes mediram; a cor é a classificação da Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 por dia, ao longo de 14 dias",
    adminVitalTrendPick: "Web Vital a representar",
    adminPerformanceRequests: "Pedidos, no Worker",
    adminPerformancePageRequests: "Chamadas à API, vistas pela página",
    adminPerformanceQueries: "Consultas à base de dados mais lentas",
    adminRequestColumn: "Pedido",
    adminQueryColumn: "Consulta",
    adminMaxColumn: "Máx.",
    adminErrorsColumn: "Erros",
    adminSlowestRequests: "Pedidos mais lentos",
    adminPathColumn: "Caminho",
    adminDurationColumn: "Duração",
    adminWhenColumn: "Quando",
    adminAllPerformance: "Todo o desempenho",
    adminTraceSpans: "Segmentos do rastreio",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "sem medições",
    adminPerformanceNotLoaded: "Não foi possível carregar o desempenho. Tente novamente.",
    adminPerformancePeriod: {
      one: "O último {count} dia",
      other: "Os últimos {count} dias",
    },
    adminMeasurements: {
      one: "{count} medição",
      other: "{count} medições",
    },
    adminTraceNotFound: "Este rastreio já não está guardado.",
    adminTraceSummary: {
      one: "{duration}, {count} segmento, {time}",
      other: "{duration}, {count} segmentos, {time}",
    },
  },
};

export { adminPerformance };
