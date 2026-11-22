# Admin area

Users with a verified email at `ADMIN_EMAIL_DOMAIN`
(`chealt.com`, in `wrangler.toml`) are admins (`packages/worker/src/admin.js`).
The Worker runs first for `/{lang}/admin*` and serves those pages only to
admins (404 for everyone else, never cached), and the admin API
(`/api/admin/*`, the guard's `admin` policy) answers only them (403
otherwise). The account menu links admins to `/{lang}/admin/`.

## Overview and dashboard

The overview, `/{lang}/admin/`, starts with a dashboard: bar charts of the
errors, page views and sign-ins per day for the last 30 days, each with its
total and a link to the page with more (errors, usage), and the 10 most
visited pages of those days (the `page_path` counts), each with a bar as long
as its share of the first. One request,
`GET /api/admin/dashboard` (`packages/worker/src/admin-dashboard.js`), counts
them from the admin database. Below it, the sections are listed.

The charts are `components/bar-chart`, shared with the usage page: the Astro
component renders the chart's frame, and `renderBarChart` fills in a bar per
day.
