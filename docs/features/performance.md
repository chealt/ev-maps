# Performance

Measured the OpenTelemetry way, and kept 14 days in the admin database
(`spans` and `web_vitals`, `admin-migrations/0003_performance.sql`), with no
user IDs and no IP addresses.

## Traces

A trace follows one API call through every layer, each with its span:

1. **The page** (`src/lib/performance.js`) wraps `fetch`: every call to the
   API (not the telemetry, usage and errors calls) is a client
   span, and gets a W3C `traceparent` header with its trace and span IDs. A
   page samples its traces (20%); only sampled pages send their spans.
2. **The Worker** (`src/tracing.js`) continues that trace with a server span
   for the request, named after the route that handled it (or starts a trace,
   sampled at `TRACE_SAMPLE_RATE`, default 0.2). Routes marked `untraced`
   (telemetry, usage, errors) aren't recorded.
3. **D1**: the app database's binding is wrapped, so every query and batch
   is a child span of the request, with its statement (`?` placeholders, no
   values). The current trace is found with `AsyncLocalStorage`, so the
   wrapped binding works for anything holding it, e.g. Better Auth.

The Worker writes a trace when it's sampled, slower than a second, or
failed (5xx), after the response. Spans use OpenTelemetry's semantic
conventions: `http.request.method`, `http.route`, `url.path`,
`http.response.status_code`, `db.system`, `db.namespace`,
`db.operation.name`, `db.query.text`, `db.operation.batch.size`.

## Web Vitals

Pages (not the admin area) report LCP, INP, CLS, FCP and TTFB with
[web-vitals](https://github.com/GoogleChrome/web-vitals), with their rating
and the kind of page (home, country, legal).

## Sending

The page sends its spans and Web Vitals batched to `POST /api/telemetry`
(`src/telemetry.js`) every 30 seconds and when it's left. The Worker keeps
only valid spans and vitals, and only known attributes, and deletes what's
older than 14 days every 15 minutes.
