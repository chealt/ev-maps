# Filters and settings

The Filters dialog has connector types (OR'ed:
a charger needs one of them), power ranges and operators, which must all
match. Operators are listed from the loaded chargers, all ticked, and the
ones turned off are saved (`excludedOperators`), so new operators show. The
choice is saved in IndexedDB with when it changed, and the Filters button
shows how many filters are on. Signed in, each change is also saved to the
account a second later (or as the dialog closes) with the Worker's
`PUT /api/settings` (`packages/worker/src/settings.js`, D1 table
`user_settings`). After signing in, the newer of the device's and the
account's filters wins: the account's apply, or the device's are saved.
Settings are sections (`filters`, later favorites and others), each with
`updatedAt`, and the Worker keeps the newer copy of each.
