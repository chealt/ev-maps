-- Performance (src/tracing.js, src/telemetry.js), kept 14 days.
--
-- spans: OpenTelemetry-style spans of sampled traces, from the page (client
-- spans of its API calls) through the Worker (the server span of the
-- request) to D1 (a span per query). Attributes follow OpenTelemetry's
-- semantic conventions (http.request.method, http.route, db.query.text...).
-- No user IDs, no IP addresses.
CREATE TABLE spans (
  id INTEGER PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  -- "client", "server" or "internal"
  kind TEXT NOT NULL,
  -- "page", "worker" or "d1"
  service TEXT NOT NULL,
  -- Milliseconds since the epoch, and how long it took.
  start_time REAL NOT NULL,
  duration REAL NOT NULL,
  -- "ok" or "error"
  status TEXT NOT NULL,
  attributes TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX spans_trace ON spans (trace_id);
CREATE INDEX spans_created_at ON spans (created_at);
CREATE INDEX spans_kind ON spans (service, kind, created_at);

-- Core Web Vitals from the pages (LCP, INP, CLS, FCP, TTFB).
CREATE TABLE web_vitals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  -- "good", "needs-improvement" or "poor"
  rating TEXT NOT NULL,
  -- "home", "country", "legal"
  page_kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX web_vitals_created_at ON web_vitals (created_at, name);
