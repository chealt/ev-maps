# Live availability

Sources that publish it are polled (EIPA every 5
minutes, France's IRVE every 15) (`packages/worker/src/live-status.js`), and
each source's statuses are stored as a few rows (split by charger ID), so a
refresh is a few writes. When a charger's details open, the page asks
`/api/chargers/status` for its records' statuses and shows how many points are
free, keeping them in memory for a minute; they never go into the cached
tiles. The service worker (`public/sw.js`) keeps one in-memory cache of them
for every tab, also fresh for a minute: it fetches only the IDs that aren't
fresh, waits for IDs another tab is already fetching, so two tabs make one
request per batch, and drops them all on sign-out. Signed in, the page also
asks for the statuses of the charger pins on the map (in batches of up to 100
IDs, again every 2 minutes while visible) and makes a pin red while none of
its charger's points is free.
