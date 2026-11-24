# Admin area

Users with a verified email at `ADMIN_EMAIL_DOMAIN`
(`chealt.com`, in `wrangler.toml`) are admins (`packages/admin/src/admin.js`).
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
`GET /api/admin/dashboard` (`packages/admin/src/admin-dashboard.js`), counts
them from the admin database. The sections are only in the navigation at
the top of every admin page.

The charts are `components/bar-chart`, shared with the usage page: the Astro
component renders the chart's frame, and `renderBarChart` fills in a bar per
day.

## Suggested chargers

Signed-in users can open **Suggest a charger** from the account menu
(`<ev-suggest-charger-dialog>`) and submit a new charger location with a
proof photo and one or more chargers (connector type, power in kW and
quantity) to `POST /api/charger-suggestions`
(`packages/worker/src/charger-suggestions.js`). They can also open
**My suggested chargers** from the account menu (`/{lang}/suggestions/`,
`<ev-user-suggestions>`) to view their own submitted suggestions and filter
them by status (`pending`, `approved`, `rejected`).

Suggestions and their uploaded proof photos
(`GET /api/charger-suggestions/{id}/photo`, served with
`Cache-Control: private, no-store`) are scoped strictly to the submitting
user and admins — no other user or public charger tile can access the
uploaded picture. Admins review suggestions at `/{lang}/admin/suggestions/`
(`<ev-admin-suggestions>`, `GET /api/admin/charger-suggestions`, filterable
by `pending`, `approved`, `rejected` or all) and approve or reject them;
approving a suggestion upserts the charger details (without the proof photo)
into `chargers` and `chargers_rtree` with source `community`.
