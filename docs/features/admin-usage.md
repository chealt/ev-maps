# Usage stats

Counts per day in the admin database (`usage_daily`,
`packages/admin/src/usage.js`), no identifiers. The Worker counts sign-ups,
sign-ins (Better Auth's database hooks), planned routes and favorites
added; pages count page views (by language and kind, and by path, e.g.
`/hu/hu/`, the admin area left out), chargers opened,
filters used, Locate me, the list and sign-in attempts
(`src/lib/usage.js`) and send them batched to `POST /api/usage` (known
events only, capped counts, 60 per IP address per minute), which adds the
visitors' country. Kept about 13 months. Admins see them at `/{lang}/admin/usage/`
(`<ev-admin-usage>`, `GET /api/admin/usage?days=7|30|90`): totals, page
views per day, and each event by its dimension (pages, countries, sources,
filters, sign-in methods).

Below the breakdowns, the 10 chargers most users have as a favorite now:
`GET /api/admin/usage` also counts the main database's `favorites` per
charger (`mostFavorited` in `packages/admin/src/admin.js`), named from the
copy the favorites keep. Favorites are kept, not counted per day, so this
doesn't change with the period.

Only production's own traffic is counted, as for the performance numbers
(`PRODUCTION_HOSTS`, `src/real-traffic.js`): the pull requests' previews
share the admin database but count nothing, neither the pages' reports nor
the Worker's own events (sign-ins, routes, favorites). The request's
trace carries the decision, so events counted without the request at hand
(e.g. Better Auth's hooks) follow it too.
