// Magyar: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Elmúlt 24 óra",
    adminPerformance: "Teljesítmény",
    adminPerformanceDescription: "milyen gyorsak az oldalak és a kérések, egészen az adatbázisig",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "A látogatók böngészőinek mérései közül a 75. percentilis; a szín a Google értékelése.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminVitalTrend: "P75 naponta, 14 napon át",
    adminVitalTrendPick: "Ábrázolt Web Vital",
    adminPerformanceRequests: "Kérések a Workerben",
    adminPerformancePageRequests: "API-hívások az oldal szemszögéből",
    adminPerformanceQueries: "Leglassabb adatbázis-lekérdezések",
    adminRequestColumn: "Kérés",
    adminQueryColumn: "Lekérdezés",
    adminMaxColumn: "Max.",
    adminErrorsColumn: "Hibák",
    adminSlowestRequests: "Leglassabb kérések",
    adminPathColumn: "Útvonal",
    adminDurationColumn: "Időtartam",
    adminWhenColumn: "Mikor",
    adminAllPerformance: "Teljes teljesítmény",
    adminTraceSpans: "A nyomvonal szakaszai",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} mp",
    adminVitalDay: "{day}: {value}",
    adminNoMeasurements: "nincs mérés",
    adminPerformanceNotLoaded: "Nem sikerült betölteni a teljesítményt. Próbáld újra.",
    adminPerformancePeriod: {
      one: "Az elmúlt {count} nap",
      other: "Az elmúlt {count} nap",
    },
    adminMeasurements: {
      one: "{count} mérés",
      other: "{count} mérés",
    },
    adminTraceNotFound: "Ezt a nyomvonalat már nem őrizzük.",
    adminTraceSummary: {
      one: "{duration}, {count} szakasz, {time}",
      other: "{duration}, {count} szakasz, {time}",
    },
  },
};

export { adminPerformance };
