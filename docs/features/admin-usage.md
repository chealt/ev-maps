# Usage stats

Counts per day in the admin database (`usage_daily`,
`packages/worker/src/usage.js`), no identifiers. The Worker counts sign-ups,
sign-ins (Better Auth's database hooks), planned routes and favorites
added; pages count page views (by language and kind), chargers opened,
filters used, Locate me, the list and sign-in attempts
(`src/lib/usage.js`) and send them batched to `POST /api/usage` (known
events only, capped counts, 60 per IP address per minute), which adds the
visitors' country. Kept about 13 months. Admins see them at `/{lang}/admin/usage/`
(`<ev-admin-usage>`, `GET /api/admin/usage?days=7|30|90`): totals, page
views per day, and each event by its dimension (pages, countries, sources,
filters, sign-in methods).
