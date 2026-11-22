# Errors

The Worker records what it doesn't handle (failing requests,
scheduled runs, import and status jobs) and the pages report their uncaught
errors and rejected promises (`src/lib/error-reporting.js`) to
`POST /api/errors` (open, 30 per IP address per minute). They go to the
separate admin database (`ev-maps-admin`, binding `ADMIN_DB`,
`packages/worker/admin-migrations/`) with a fingerprint that groups the
same error (`packages/worker/src/errors.js`), and are kept 30 days. Admins
see them at `/{lang}/admin/errors/` (`<ev-admin-errors>`): the groups, most
recently seen first, with counts, users, first and last seen, and each
group's occurrences with the URL, browser, user, country, job and stack
trace (`GET /api/admin/errors`, `/api/admin/errors/{fingerprint}`, 25 and 20
a page).
