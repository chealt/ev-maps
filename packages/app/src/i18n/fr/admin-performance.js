// Français: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Dernières 24 heures",
    adminPerformance: "Performances",
    adminPerformanceDescription:
      "la rapidité des pages et des requêtes, jusqu'aux requêtes de la base de données",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "Le 75e percentile de ce que les navigateurs des visiteurs ont mesuré ; la couleur est l'évaluation de Google.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 par jour, sur 14 jours",
    adminVitalTrendPick: "Web Vital à afficher",
    adminPerformanceRequests: "Requêtes, dans le Worker",
    adminPerformancePageRequests: "Appels d'API, vus par la page",
    adminPerformanceQueries: "Requêtes de base de données les plus lentes",
    adminRequestColumn: "Requête",
    adminQueryColumn: "Requête SQL",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Erreurs",
    adminSlowestRequests: "Requêtes les plus lentes",
    adminPathColumn: "Chemin",
    adminDurationColumn: "Durée",
    adminWhenColumn: "Quand",
    adminAllPerformance: "Toutes les performances",
    adminTraceSpans: "Spans de la trace",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminVitalDay: "{day} : {value}",
    adminNoMeasurements: "aucune mesure",
    adminPerformanceNotLoaded: "Les performances n'ont pas pu être chargées. Réessaie.",
    adminPerformancePeriod: {
      one: "Le dernier jour",
      other: "Les {count} derniers jours",
    },
    adminMeasurements: {
      one: "{count} mesure",
      other: "{count} mesures",
    },
    adminTraceNotFound: "Cette trace n'est plus conservée.",
    adminTraceSummary: {
      one: "{duration}, {count} span, {time}",
      other: "{duration}, {count} spans, {time}",
    },
  },
};

export { adminPerformance };
