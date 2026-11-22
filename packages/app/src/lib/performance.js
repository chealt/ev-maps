// Measures the site's performance for the admin area (POST /api/telemetry,
// packages/worker/src/telemetry.js), the OpenTelemetry way:
//
// - Every API call is a client span with a W3C traceparent header, so the
//   Worker's request and its database queries are spans of the same trace
//   (packages/worker/src/tracing.js). A page samples its traces at
//   TRACE_SAMPLE_RATE, and only sampled pages send their spans.
// - Core Web Vitals (LCP, INP, CLS, FCP, TTFB), with Google's web-vitals.
//
// Both are sent batched, every 30 seconds and when the page is left. No
// identifiers: only the page's kind and the API paths.
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { pageKind } from "./page-kind.js";

const TELEMETRY_URL = "/api/telemetry";
const SEND_EVERY_MS = 30 * 1000;
const TRACE_SAMPLE_RATE = 0.2;
// Calls about measuring aren't traced.
const UNTRACED = ["/api/telemetry", "/api/usage", "/api/errors"];

const kind = pageKind(window.location.pathname);
const sampled = Math.random() < TRACE_SAMPLE_RATE;
let spans = [];
let vitals = [];

const randomHex = (bytes) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// The route of a path, for grouping: IDs and numbers become placeholders,
// e.g. /api/chargers/12/2264/1434 → /api/chargers/{id}/{id}/{id}.
const routeOf = (pathname) =>
  pathname
    .split("/")
    .map((part) => (/\d|%3A/i.test(part) ? "{id}" : part))
    .join("/");

const isTraced = (url) =>
  url.origin === window.location.origin &&
  url.pathname.startsWith("/api/") &&
  !UNTRACED.some((path) => url.pathname.startsWith(path));

const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : input, window.location.href);
  if (!isTraced(url)) {
    return originalFetch(input, init);
  }
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const headers = new Headers(init?.headers ?? request?.headers);
  headers.set("traceparent", `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const start = Date.now();
  const startedAt = performance.now();
  const record = (statusCode) => {
    if (!sampled) {
      return;
    }
    spans.push({
      traceId,
      spanId,
      name: `${method} ${routeOf(url.pathname)}`,
      start,
      duration: performance.now() - startedAt,
      status: statusCode === 0 || statusCode >= 500 ? "error" : "ok",
      attributes: {
        "http.request.method": method,
        "url.path": url.pathname,
        "http.response.status_code": statusCode,
      },
    });
  };
  try {
    const response = await originalFetch(input, { ...init, headers });
    record(response.status);
    return response;
  } catch (error) {
    record(0);
    throw error;
  }
};

if (kind) {
  const report = ({ name, value, rating }) => vitals.push({ name, value, rating, pageKind: kind });
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
}

const send = () => {
  if (!spans.length && !vitals.length) {
    return;
  }
  const body = JSON.stringify({ spans, vitals });
  spans = [];
  vitals = [];
  // keepalive: sent even while the page is being left.
  originalFetch(TELEMETRY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
};

setInterval(send, SEND_EVERY_MS);
window.addEventListener("pagehide", send);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    send();
  }
});

export { routeOf, send };
