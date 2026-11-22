// English: the admin area's performance page. See ../index.js for how
// the sections are put together and which pages get which.

const adminPerformance = {
  page: {
    adminLast24Hours: "Last 24 hours",
    adminPerformance: "Performance",
    adminPerformanceDescription: "how fast pages and requests are, down to the database queries",
    adminWebVitals: "Core Web Vitals (P75)",
    adminWebVitalsHint:
      "The 75th percentile of what visitors' browsers measured; the color is Google's rating of it.",
    adminVitalLCP: "Largest Contentful Paint",
    adminVitalINP: "Interaction to Next Paint",
    adminVitalCLS: "Cumulative Layout Shift",
    adminVitalFCP: "First Contentful Paint",
    adminVitalTTFB: "Time to First Byte",
    adminPerformanceRequests: "Requests, in the Worker",
    adminPerformancePageRequests: "API calls, as the page saw them",
    adminPerformanceQueries: "Slowest database queries",
    adminRequestColumn: "Request",
    adminQueryColumn: "Query",
    adminMaxColumn: "Max",
    adminErrorsColumn: "Errors",
    adminSlowestRequests: "Slowest requests",
    adminPathColumn: "Path",
    adminDurationColumn: "Took",
    adminWhenColumn: "When",
    adminAllPerformance: "All performance",
    adminTraceSpans: "Spans of the trace",
  },
  messages: {
    adminMilliseconds: "{value} ms",
    adminSeconds: "{value} s",
    adminPerformanceNotLoaded: "The performance couldn't be loaded. Try again.",
    adminPerformancePeriod: {
      one: "The last {count} day",
      other: "The last {count} days",
    },
    adminMeasurements: {
      one: "{count} measurement",
      other: "{count} measurements",
    },
    adminTraceNotFound: "This trace isn't kept any more.",
    adminTraceSummary: {
      one: "{duration}, {count} span, {time}",
      other: "{duration}, {count} spans, {time}",
    },
  },
};

export { adminPerformance };
