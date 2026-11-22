# Admin area

Users with a verified email at `ADMIN_EMAIL_DOMAIN`
(`chealt.com`, in `wrangler.toml`) are admins (`packages/worker/src/admin.js`).
The Worker runs first for `/{lang}/admin*` and serves those pages only to
admins (404 for everyone else, never cached), and the admin API
(`/api/admin/*`, the guard's `admin` policy) answers only them (403
otherwise). The account menu links admins to `/{lang}/admin/`.
