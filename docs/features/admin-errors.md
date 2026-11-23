# Errors

The Worker records what it doesn't handle (failing requests,
scheduled runs, import and status jobs) and the pages report their uncaught
errors and rejected promises (`src/lib/error-reporting.js`) to
`POST /api/errors` (open, 30 per IP address per minute). They go to the
separate admin database (`ev-maps-admin`, binding `ADMIN_DB`,
`packages/admin/migrations/admin-migrations/`) with a fingerprint that groups the
same error (`packages/admin/src/errors.js`), and are kept 30 days. Admins
see them at `/{lang}/admin/errors/`: the groups, most
recently seen first, with counts, users, first and last seen, and each
group's occurrences with the URL, browser, user, country, job and stack
trace (`?error={fingerprint}`), 25 and 20 a page (`?page=`).

## Rendered on the server

The page has no script: Astro renders it per request (`prerender = false`,
with the Cloudflare adapter), and its links and pages are plain URLs.

1. The Worker gets `/{lang}/admin/errors/` and checks the user is an admin
   (`packages/admin/src/admin.js`, 404 otherwise).
2. It reads the errors from the admin database, like the API does, and hands
   the request to Astro's server (`packages/worker/src/app-server.js`, which
   imports `packages/app/dist/server/entry.mjs`) with them as the context's
   props: `{ data }`, or `{ failed: true }` if they couldn't be read.
3. The page reads them (`src/lib/page-data.js`) and renders them in its
   language; the response is never cached.

The same data is in the API (`GET /api/admin/errors?page=`,
`/api/admin/errors/{fingerprint}?page=`). In development without the Worker
in front, the page reads it from there (`bun run dev`, as the signed-in user);
the tests pass it in the `x-ev-maps-page-data` header instead.

To render another page on the server: `export const prerender = false` in
the page, and an entry in `SERVER_RENDERED_PAGES` (`admin.js`) that reads its
data.
