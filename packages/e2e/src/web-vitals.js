// The page's load metrics, measured in the browser from the Performance API
// (like the web-vitals library, without its script): TTFB, FCP, LCP and CLS
// of the current document, in milliseconds (CLS has no unit). A metric the
// browser hasn't reported is null.
// Google's thresholds for good and poor (web.dev/articles/vitals); the same
// as the admin performance page's (packages/admin/src/performance-stats.js).
const THRESHOLDS = {
  TTFB: [800, 1800],
  FCP: [1800, 3000],
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
};

const measureWebVitals = (page) =>
  page.evaluate(async () => {
    const buffered = (type) =>
      new Promise((resolve) => {
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        try {
          observer.observe({ type, buffered: true });
        } catch {
          resolve([]);
          return;
        }
        // Buffered entries are delivered in the next task.
        setTimeout(() => {
          entries.push(...observer.takeRecords());
          observer.disconnect();
          resolve(entries);
        }, 50);
      });
    const [navigation] = performance.getEntriesByType("navigation");
    const fcp = (await buffered("paint")).find((entry) => entry.name === "first-contentful-paint");
    const lcp = (await buffered("largest-contentful-paint")).at(-1);
    // CLS: the largest session window of shifts (1 s apart at most, 5 s at
    // most), leaving out those right after input.
    let cls = 0;
    let session = 0;
    let first = 0;
    let last = 0;
    for (const shift of await buffered("layout-shift")) {
      if (shift.hadRecentInput) {
        continue;
      }
      if (session && (shift.startTime - last > 1000 || shift.startTime - first > 5000)) {
        session = 0;
      }
      if (!session) {
        first = shift.startTime;
      }
      session += shift.value;
      last = shift.startTime;
      cls = Math.max(cls, session);
    }
    const round = (value) => (value === undefined ? null : Math.round(value));
    return {
      url: location.href,
      TTFB: round(navigation?.responseStart),
      FCP: round(fcp?.startTime),
      LCP: round(lcp?.startTime),
      CLS: Math.round(cls * 1000) / 1000,
    };
  });

export { THRESHOLDS, measureWebVitals };
